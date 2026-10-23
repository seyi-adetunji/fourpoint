import prisma from "@/lib/prisma";
import {
  addDays,
  addMinutes,
  differenceInMinutes,
  format,
  isAfter,
  isBefore,
  subDays,
} from "date-fns";
import { getUTCMidnight } from "@/lib/dateUtils";
import { ensureShiftAssignmentsAccurate } from "@/lib/shiftIntegrity";

export type DeviceCategory = "STAFF_GATE" | "CANTEEN";

export interface ClassifiedDevice {
  category: DeviceCategory;
  label: string;
  sn: string;
}

/**
 * Classifies a raw ZKBioTime punch from `iclock_transaction` / `iclock_terminal`
 * into either STAFF_GATE (attendance clock in/out) or CANTEEN (meal ticket).
 */
export function classifyDevice(punch: {
  terminalSn?: string | null;
  terminalAlias?: string | null;
  terminalId?: number | null;
  terminal?: { alias?: string | null; sn?: string | null } | null;
}): ClassifiedDevice {
  const sn = (punch.terminalSn || punch.terminal?.sn || "").trim();
  const rawAlias = (punch.terminal?.alias || punch.terminalAlias || "").trim();
  const lowerAlias = rawAlias.toLowerCase();

  // Known Canteen terminal SN (TTQ5251600240), terminalId 1, or alias containing "canteen"
  if (
    sn === "TTQ5251600240" ||
    punch.terminalId === 1 ||
    lowerAlias.includes("canteen")
  ) {
    return {
      category: "CANTEEN",
      label: "Canteen Device",
      sn: sn || "TTQ5251600240",
    };
  }

  // Known Staff Gate terminal SN (TTQ5251600205), terminalId 3, or alias containing "gate" / "auto add"
  if (
    sn === "TTQ5251600205" ||
    punch.terminalId === 3 ||
    lowerAlias.includes("gate") ||
    lowerAlias === "auto add"
  ) {
    return {
      category: "STAFF_GATE",
      label: "Staff Gate",
      sn: sn || "TTQ5251600205",
    };
  }

  return {
    category: "STAFF_GATE",
    label: rawAlias || sn || "Staff Gate",
    sn,
  };
}

function buildShiftBounds(
  dateStr: string,
  template: { startTime: string; endTime: string }
): { expectedStart: Date; expectedEnd: Date; scheduledMinutes: number } {
  const [startH, startM] = template.startTime.split(":").map(Number);
  const [endH, endM] = template.endTime.split(":").map(Number);

  const expectedStart = new Date(`${dateStr}T00:00:00`);
  expectedStart.setHours(startH || 0, startM || 0, 0, 0);

  let expectedEnd = new Date(`${dateStr}T00:00:00`);
  expectedEnd.setHours(endH || 0, endM || 0, 0, 0);
  if (expectedEnd.getTime() <= expectedStart.getTime()) {
    expectedEnd = addDays(expectedEnd, 1);
  }

  const scheduledMinutes = Math.max(
    60,
    differenceInMinutes(expectedEnd, expectedStart)
  );
  return { expectedStart, expectedEnd, scheduledMinutes };
}

/**
 * Synchronizes / computes `AttendanceResult` rows for a given date range
 * using:
 *   1. Clean, deduplicated `ShiftAssignment` records (in `workforce.ShiftAssignment`)
 *   2. Biometric punches from `public.iclock_transaction` (separating Staff Gate vs Canteen)
 *
 * Properly handles:
 *   - Shift integrity normalization before evaluation (no cancelled/duplicate ghost shifts)
 *   - Local hotel timezone (WAT / server local time) when comparing shift start/end times
 *   - Both single shifts and continuous or split Double Shifts (`Morning` + `Afternoon`)
 *   - Active ongoing shifts today (employees who clocked IN today and haven't clocked OUT yet
 *     are marked PRESENT or LATE rather than MISSING_PUNCH)
 *   - Unscheduled Staff Gate punches matched against Morning / Afternoon templates
 */
export async function syncAttendanceResultsForRange(
  startDate: Date,
  endDate: Date
) {
  await ensureShiftAssignmentsAccurate();

  const startIso = startDate.toISOString().slice(0, 10);
  const endIso = endDate.toISOString().slice(0, 10);
  const startUTC = getUTCMidnight(startIso);
  const endUTC = getUTCMidnight(endIso);
  const now = new Date();
  const todayIso = format(now, "yyyy-MM-dd");

  // Fetch all active shifts in [startUTC, endUTC]
  const [assignments, allTemplates] = await Promise.all([
    prisma.shiftAssignment.findMany({
      where: {
        workDate: { gte: startUTC, lte: endUTC },
        status: { not: "CANCELLED" },
      },
      include: { shiftTemplate: true, employee: true },
      orderBy: [{ workDate: "asc" }, { employeeId: "asc" }, { sequence: "asc" }],
    }),
    prisma.shiftTemplate.findMany({
      orderBy: { startTime: "asc" },
    }),
  ]);

  // Fetch all punches in window [startUTC - 1d, endUTC + 2d] to cover local TZ boundaries & night shifts
  const punchWindowStart = subDays(startUTC, 1);
  const punchWindowEnd = addDays(endUTC, 2);

  const rawPunches = await prisma.iclockTransaction.findMany({
    where: {
      punchTime: { gte: punchWindowStart, lte: punchWindowEnd },
    },
    include: { terminal: true, employee: true },
    orderBy: { punchTime: "asc" },
  });

  // Map empCode -> employeeId for any punches where empId is null
  const missingEmpCodes = Array.from(
    new Set(
      rawPunches.filter((p) => !p.empId && p.empCode).map((p) => p.empCode)
    )
  );
  const empByCode = new Map<string, number>();
  if (missingEmpCodes.length > 0) {
    const foundEmps = await prisma.employee.findMany({
      where: { empCode: { in: missingEmpCodes } },
      select: { id: true, empCode: true },
    });
    for (const e of foundEmps) {
      empByCode.set(e.empCode, e.id);
    }
  }

  type NormalizedPunch = (typeof rawPunches)[number] & {
    resolvedEmpId: number | null;
    localDateStr: string;
    device: ClassifiedDevice;
  };

  const normalizedPunches: NormalizedPunch[] = rawPunches.map((p) => ({
    ...p,
    resolvedEmpId: p.empId ?? empByCode.get(p.empCode) ?? null,
    localDateStr: format(new Date(p.punchTime), "yyyy-MM-dd"),
    device: classifyDevice(p),
  }));

  const gatePunches = normalizedPunches.filter(
    (p) => p.resolvedEmpId != null && p.device.category === "STAFF_GATE"
  );
  const canteenPunches = normalizedPunches.filter(
    (p) => p.resolvedEmpId != null && p.device.category === "CANTEEN"
  );

  // Clear existing non-corrected AttendanceResult rows across the entire [startUTC, endUTC] range
  // so that even dates whose shifts were deleted are completely purged of stale ABSENT records.
  await prisma.attendanceException.deleteMany({
    where: {
      workDate: { gte: startUTC, lte: endUTC },
      status: "PENDING",
      OR: [
        { attendanceResultId: null },
        { attendanceResult: { corrections: { none: {} } } },
      ],
    },
  });
  await prisma.attendanceResult.deleteMany({
    where: {
      workDate: { gte: startUTC, lte: endUTC },
      corrections: { none: {} },
    },
  });

  // Track any (employeeId, dateStr, sequence) preserved because of manual corrections
  const correctedResults = await prisma.attendanceResult.findMany({
    where: {
      workDate: { gte: startUTC, lte: endUTC },
    },
    select: {
      employeeId: true,
      workDate: true,
      sequence: true,
      shiftAssignmentId: true,
    },
  });
  const correctedKeys = new Set(
    correctedResults.map(
      (cr) =>
        `${cr.employeeId}|${cr.workDate.toISOString().slice(0, 10)}|${cr.sequence}`
    )
  );
  const correctedAssignmentIds = new Set(
    correctedResults
      .map((cr) => cr.shiftAssignmentId)
      .filter((id): id is string => Boolean(id))
  );

  // Collect all distinct dates in [startIso, endIso] that have either a shift assignment or a gate punch
  const activeDateStrings = new Set<string>();
  for (const a of assignments) {
    const dStr = a.workDate.toISOString().slice(0, 10);
    if (dStr >= startIso && dStr <= endIso) {
      activeDateStrings.add(dStr);
    }
  }
  for (const p of gatePunches) {
    if (p.localDateStr >= startIso && p.localDateStr <= endIso) {
      activeDateStrings.add(p.localDateStr);
    }
  }

  if (activeDateStrings.size === 0) {
    return { processed: 0 };
  }

  // Ensure a fallback ShiftTemplate exists for unscheduled Staff Gate attendance
  let defaultTemplate = allTemplates[0];
  if (!defaultTemplate) {
    defaultTemplate = await prisma.shiftTemplate.create({
      data: {
        code: "GEN",
        name: "General Shift",
        startTime: "08:00",
        endTime: "17:00",
        color: "#3B82F6",
        graceLate: 15,
        graceEarly: 15,
        breakMinutes: 60,
      },
    });
    allTemplates.push(defaultTemplate);
  }

  const morningTemplate =
    allTemplates.find(
      (t) =>
        t.code.toUpperCase().startsWith("M") ||
        t.name.toLowerCase().includes("morning")
    ) || defaultTemplate;

  const afternoonTemplate =
    allTemplates.find(
      (t) =>
        t.code.toUpperCase().startsWith("A") ||
        t.name.toLowerCase().includes("afternoon")
    ) || defaultTemplate;

  const rowsToInsert: Array<{
    employeeId: number;
    workDate: Date;
    shiftTemplateId: string;
    shiftAssignmentId: string | null;
    sequence: number;
    actualIn: Date | null;
    actualOut: Date | null;
    workedMinutes: number;
    lateMinutes: number;
    earlyExitMinutes: number;
    overtimeMinutes: number;
    breakMinutes: number;
    status: string;
    remarks: string;
  }> = [];

  for (const dateStr of Array.from(activeDateStrings).sort()) {
    const dayUTC = getUTCMidnight(dateStr);
    const isToday = dateStr === todayIso;
    const isFuture = dateStr > todayIso;

    const dayAssignments = assignments.filter(
      (a) => a.workDate.toISOString().slice(0, 10) === dateStr
    );

    const empAssignMap = new Map<number, typeof dayAssignments>();
    for (const a of dayAssignments) {
      const list = empAssignMap.get(a.employeeId) || [];
      list.push(a);
      empAssignMap.set(a.employeeId, list);
    }

    const consumedPunchIds = new Set<number>();

    // 1. Process all employees with scheduled shifts on this day
    for (const [employeeId, rawEmpAssignments] of empAssignMap.entries()) {
      const empAssignments = [...rawEmpAssignments].sort((a, b) => {
        const tCmp = a.shiftTemplate.startTime.localeCompare(
          b.shiftTemplate.startTime
        );
        return tCmp !== 0 ? tCmp : a.sequence - b.sequence;
      });

      const empGatePunches = gatePunches.filter(
        (p) => p.resolvedEmpId === employeeId
      );
      const empCanteenPunches = canteenPunches.filter(
        (p) => p.resolvedEmpId === employeeId && p.localDateStr === dateStr
      );
      const canteenNote =
        empCanteenPunches.length > 0
          ? `Canteen: ${empCanteenPunches
              .map((c) => format(new Date(c.punchTime), "HH:mm"))
              .join(", ")}`
          : null;

      // Helper to evaluate a single shift given matched [punchInTime, punchOutTime]
      const evaluateSingleShift = (
        assignment: (typeof empAssignments)[number],
        punchInTime: Date | null,
        punchOutTime: Date | null,
        overrideWorkedMinutes?: number,
        overrideOvertimeMinutes?: number,
        extraRemark?: string
      ) => {
        if (
          correctedAssignmentIds.has(assignment.id) ||
          correctedKeys.has(`${employeeId}|${dateStr}|${assignment.sequence}`)
        ) {
          return;
        }

        const template = assignment.shiftTemplate;
        const { expectedStart, expectedEnd, scheduledMinutes } =
          buildShiftBounds(dateStr, template);

        let status = "PRESENT";
        let lateMinutes = 0;
        let earlyExitMinutes = 0;
        let workedMinutes = 0;
        let overtimeMinutes = 0;
        const remarkParts: string[] = [];
        if (extraRemark) remarkParts.push(extraRemark);

        if (!punchInTime) {
          if (
            isFuture ||
            (isToday &&
              isBefore(now, addMinutes(expectedStart, template.graceLate)))
          ) {
            return;
          }
          status = "ABSENT";
          remarkParts.push("No Staff Gate punch recorded");
        } else {
          const lateCutoff = addMinutes(expectedStart, template.graceLate);
          const isLate = isAfter(punchInTime, lateCutoff);
          if (isLate) {
            lateMinutes = Math.max(
              0,
              differenceInMinutes(punchInTime, expectedStart)
            );
            remarkParts.push(`${lateMinutes}m late`);
          }

          if (!punchOutTime) {
            if (isToday || isBefore(now, addMinutes(expectedEnd, 180))) {
              status = isLate ? "LATE" : "PRESENT";
              workedMinutes =
                overrideWorkedMinutes ??
                Math.max(0, differenceInMinutes(now, punchInTime));
              remarkParts.push("On duty (clocked in)");
            } else {
              status = isLate ? "LATE" : "MISSING_PUNCH";
              workedMinutes = overrideWorkedMinutes ?? 0;
              remarkParts.push("Clocked in at Staff Gate; missing clock-out");
            }
          } else {
            workedMinutes =
              overrideWorkedMinutes ??
              Math.max(0, differenceInMinutes(punchOutTime, punchInTime));

            status = isLate ? "LATE" : "PRESENT";

            if (
              isBefore(
                punchOutTime,
                addMinutes(expectedEnd, -template.graceEarly)
              )
            ) {
              earlyExitMinutes = Math.max(
                0,
                differenceInMinutes(expectedEnd, punchOutTime)
              );
              status = isLate ? "LATE_AND_EARLY" : "EARLY_EXIT";
              remarkParts.push(`${earlyExitMinutes}m early exit`);
            }

            if (overrideOvertimeMinutes !== undefined) {
              overtimeMinutes = overrideOvertimeMinutes;
            } else if (workedMinutes > scheduledMinutes + 30) {
              overtimeMinutes = workedMinutes - scheduledMinutes;
            }
          }
        }

        if (canteenNote) remarkParts.push(canteenNote);

        rowsToInsert.push({
          employeeId,
          workDate: dayUTC,
          shiftTemplateId: template.id,
          shiftAssignmentId: assignment.id,
          sequence: assignment.sequence,
          actualIn: punchInTime,
          actualOut: punchOutTime,
          workedMinutes,
          lateMinutes,
          earlyExitMinutes,
          overtimeMinutes,
          breakMinutes: template.breakMinutes || 60,
          status,
          remarks: remarkParts.join(" · ") || "Staff Gate verified",
        });
      };

      if (empAssignments.length === 1) {
        const assignment = empAssignments[0];
        const { expectedStart, expectedEnd } = buildShiftBounds(
          dateStr,
          assignment.shiftTemplate
        );
        const windowStart = addMinutes(expectedStart, -240);
        const windowEnd = addMinutes(expectedEnd, 300);

        const availablePunches = empGatePunches.filter(
          (p) =>
            !consumedPunchIds.has(p.id) &&
            p.punchTime >= windowStart &&
            p.punchTime <= windowEnd
        );

        const punchIn = availablePunches.length > 0 ? availablePunches[0] : null;
        const lastCandidate =
          availablePunches.length > 1
            ? availablePunches[availablePunches.length - 1]
            : null;
        const punchOut =
          punchIn &&
          lastCandidate &&
          differenceInMinutes(lastCandidate.punchTime, punchIn.punchTime) >= 15
            ? lastCandidate
            : null;

        for (const ap of availablePunches) {
          consumedPunchIds.add(ap.id);
        }

        evaluateSingleShift(
          assignment,
          punchIn?.punchTime ?? null,
          punchOut?.punchTime ?? null
        );
      } else {
        // Multi-shift / Double Shift day (e.g. Morning + Afternoon)
        const shiftBounds = empAssignments.map((a) => ({
          assignment: a,
          ...buildShiftBounds(dateStr, a.shiftTemplate),
        }));

        const firstStart = shiftBounds[0].expectedStart;
        const latestEnd = shiftBounds.reduce(
          (maxEnd, sb) => (sb.expectedEnd > maxEnd ? sb.expectedEnd : maxEnd),
          shiftBounds[0].expectedEnd
        );

        const dayWindowStart = addMinutes(firstStart, -240);
        const dayWindowEnd = addMinutes(latestEnd, 360);

        const dayPunches = empGatePunches.filter(
          (p) =>
            !consumedPunchIds.has(p.id) &&
            p.punchTime >= dayWindowStart &&
            p.punchTime <= dayWindowEnd
        );
        for (const dp of dayPunches) {
          consumedPunchIds.add(dp.id);
        }

        if (dayPunches.length === 0) {
          for (const sb of shiftBounds) {
            evaluateSingleShift(sb.assignment, null, null);
          }
          continue;
        }

        const firstPunch = dayPunches[0].punchTime;
        const rawLast =
          dayPunches.length > 1
            ? dayPunches[dayPunches.length - 1].punchTime
            : null;
        const lastPunch =
          rawLast && differenceInMinutes(rawLast, firstPunch) >= 15
            ? rawLast
            : null;

        const secondShift = shiftBounds[1];
        const arrivedOnlyForSecondShift =
          isAfter(firstPunch, addMinutes(shiftBounds[0].expectedStart, 240)) &&
          !isBefore(firstPunch, addMinutes(secondShift.expectedStart, -90));

        if (arrivedOnlyForSecondShift) {
          // Missed Shift 1, attended Shift 2+
          evaluateSingleShift(shiftBounds[0].assignment, null, null);
          for (let i = 1; i < shiftBounds.length; i++) {
            evaluateSingleShift(
              shiftBounds[i].assignment,
              i === 1 ? firstPunch : null,
              i === 1 ? lastPunch : null
            );
          }
          continue;
        }

        // Employee arrived for Shift 1; check if they also covered Shift 2+
        const totalScheduled = shiftBounds.reduce(
          (sum, sb) => sum + sb.scheduledMinutes,
          0
        );
        const totalSpanMinutes = lastPunch
          ? Math.max(0, differenceInMinutes(lastPunch, firstPunch))
          : isToday
          ? Math.max(0, differenceInMinutes(now, firstPunch))
          : 0;

        // Covered second shift if:
        // - Still on duty today and Shift 2 has started, OR
        // - Clocked out at least 2h into Shift 2, OR worked >= 10 hours continuously
        const coveredSecondShift = lastPunch
          ? isAfter(lastPunch, addMinutes(secondShift.expectedStart, 120)) ||
            totalSpanMinutes >= 600
          : isToday && !isBefore(now, secondShift.expectedStart);

        if (coveredSecondShift) {
          const s1Worked = Math.min(
            totalSpanMinutes,
            shiftBounds[0].scheduledMinutes
          );
          const s2Worked = Math.max(0, totalSpanMinutes - s1Worked);
          const totalOT =
            lastPunch && totalSpanMinutes > totalScheduled + 30
              ? totalSpanMinutes - totalScheduled
              : 0;

          const handoffTime =
            shiftBounds[0].expectedEnd < secondShift.expectedStart
              ? secondShift.expectedStart
              : shiftBounds[0].expectedEnd;

          const s1Out =
            lastPunch && lastPunch < handoffTime
              ? lastPunch
              : lastPunch || (isToday && isAfter(now, handoffTime))
              ? handoffTime
              : null;

          evaluateSingleShift(
            shiftBounds[0].assignment,
            firstPunch,
            s1Out,
            s1Worked,
            0,
            "Double shift (1/2)"
          );

          const s2In = firstPunch > handoffTime ? firstPunch : handoffTime;
          evaluateSingleShift(
            secondShift.assignment,
            s2In,
            lastPunch,
            s2Worked,
            totalOT,
            "Double shift (2/2)"
          );

          for (let i = 2; i < shiftBounds.length; i++) {
            evaluateSingleShift(shiftBounds[i].assignment, null, null);
          }
        } else {
          // Only Shift 1 worked so far (Shift 2 either hasn't started today or was missed)
          evaluateSingleShift(shiftBounds[0].assignment, firstPunch, lastPunch);
          for (let i = 1; i < shiftBounds.length; i++) {
            evaluateSingleShift(shiftBounds[i].assignment, null, null);
          }
        }
      }
    }

    // 2. Process employees who punched at Staff Gate on this day WITHOUT a ShiftAssignment
    const unscheduledDayGatePunches = gatePunches.filter(
      (p) =>
        !consumedPunchIds.has(p.id) &&
        p.localDateStr === dateStr &&
        !empAssignMap.has(p.resolvedEmpId!)
    );

    const unscheduledByEmp = new Map<number, NormalizedPunch[]>();
    for (const p of unscheduledDayGatePunches) {
      const empId = p.resolvedEmpId!;
      const list = unscheduledByEmp.get(empId) || [];
      list.push(p);
      unscheduledByEmp.set(empId, list);
    }

    for (const [employeeId, empPunches] of unscheduledByEmp.entries()) {
      if (correctedKeys.has(`${employeeId}|${dateStr}|1`)) continue;

      const punchIn = empPunches[0];
      const lastCandidate =
        empPunches.length > 1 ? empPunches[empPunches.length - 1] : null;
      const punchOut =
        lastCandidate &&
        differenceInMinutes(lastCandidate.punchTime, punchIn.punchTime) >= 15
          ? lastCandidate
          : null;

      // Infer closest shift template (Morning vs Afternoon) from arrival hour
      const arrivalHour = new Date(punchIn.punchTime).getHours();
      const inferredTemplate =
        arrivalHour >= 12 ? afternoonTemplate : morningTemplate;
      const [startH, startM] = inferredTemplate.startTime.split(":").map(Number);
      const expectedStart = new Date(`${dateStr}T00:00:00`);
      expectedStart.setHours(startH || 0, startM || 0, 0, 0);

      let lateMinutes = 0;
      const lateCutoff = addMinutes(expectedStart, inferredTemplate.graceLate);
      const isLate =
        arrivalHour >= 5 && isAfter(punchIn.punchTime, lateCutoff);
      if (isLate) {
        lateMinutes = Math.max(
          0,
          differenceInMinutes(punchIn.punchTime, expectedStart)
        );
      }

      const workedMinutes = punchOut
        ? Math.max(
            0,
            differenceInMinutes(punchOut.punchTime, punchIn.punchTime)
          )
        : isToday
        ? Math.max(0, differenceInMinutes(now, punchIn.punchTime))
        : 0;

      const status = isLate
        ? "LATE"
        : punchOut || isToday
        ? "PRESENT"
        : "MISSING_PUNCH";

      const empCanteenPunches = canteenPunches.filter(
        (p) => p.resolvedEmpId === employeeId && p.localDateStr === dateStr
      );

      const remarkParts: string[] = ["Unscheduled (Staff Gate)"];
      if (isLate) remarkParts.push(`${lateMinutes}m late`);
      if (!punchOut) {
        remarkParts.push(
          isToday ? "On duty (clocked in)" : "Single punch (no OUT)"
        );
      }
      if (empCanteenPunches.length > 0) {
        const canteenTimes = empCanteenPunches
          .map((c) => format(new Date(c.punchTime), "HH:mm"))
          .join(", ");
        remarkParts.push(`Canteen: ${canteenTimes}`);
      }

      rowsToInsert.push({
        employeeId,
        workDate: dayUTC,
        shiftTemplateId: inferredTemplate.id,
        shiftAssignmentId: null,
        sequence: 1,
        actualIn: punchIn.punchTime,
        actualOut: punchOut?.punchTime ?? null,
        workedMinutes,
        lateMinutes,
        earlyExitMinutes: 0,
        overtimeMinutes: workedMinutes > 540 ? workedMinutes - 480 : 0,
        breakMinutes: inferredTemplate.breakMinutes || 60,
        status,
        remarks: remarkParts.join(" · "),
      });
    }
  }

  if (rowsToInsert.length > 0) {
    await prisma.attendanceResult.createMany({
      data: rowsToInsert,
    });
  }

  return { processed: rowsToInsert.length };
}
