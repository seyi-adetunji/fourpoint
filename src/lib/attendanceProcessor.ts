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

/**
 * Synchronizes / computes `AttendanceResult` rows for a given date range
 * using:
 *   1. Scheduled `ShiftAssignment` records (in `workforce.ShiftAssignment`)
 *   2. Biometric punches from `public.iclock_transaction` (separating Staff Gate vs Canteen)
 *
 * Properly handles:
 *   - Local hotel timezone (WAT / server local time) when comparing shift start/end times
 *   - Active ongoing shifts today (employees who clocked IN today and haven't clocked OUT yet
 *     are marked PRESENT or LATE rather than MISSING_PUNCH)
 *   - Lateness calculation on arrival (`punchIn`) even before clock-out
 *   - Unscheduled Staff Gate punches matched against Morning / Afternoon templates
 */
export async function syncAttendanceResultsForRange(
  startDate: Date,
  endDate: Date
) {
  const startIso = startDate.toISOString().slice(0, 10);
  const endIso = endDate.toISOString().slice(0, 10);
  const startUTC = getUTCMidnight(startIso);
  const endUTC = getUTCMidnight(endIso);
  const now = new Date();
  const todayIso = format(now, "yyyy-MM-dd");

  // Fetch all shifts in [startUTC, endUTC]
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

  // Clear existing AttendanceResult rows in these active dates that don't have manual corrections
  const targetDates = Array.from(activeDateStrings).map((d) => getUTCMidnight(d));
  await prisma.attendanceException.deleteMany({
    where: {
      workDate: { in: targetDates },
      status: "PENDING",
    },
  });
  await prisma.attendanceResult.deleteMany({
    where: {
      workDate: { in: targetDates },
      corrections: { none: {} },
    },
  });

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
    for (const [employeeId, empAssignments] of empAssignMap.entries()) {
      const empGatePunches = gatePunches.filter(
        (p) => p.resolvedEmpId === employeeId
      );
      const empCanteenPunches = canteenPunches.filter(
        (p) => p.resolvedEmpId === employeeId && p.localDateStr === dateStr
      );

      for (const assignment of empAssignments) {
        const template = assignment.shiftTemplate;
        const [startH, startM] = template.startTime.split(":").map(Number);
        const [endH, endM] = template.endTime.split(":").map(Number);

        // Construct expected start/end in local server time (matching biometric clock time)
        const expectedStart = new Date(`${dateStr}T00:00:00`);
        expectedStart.setHours(startH || 0, startM || 0, 0, 0);

        let expectedEnd = new Date(`${dateStr}T00:00:00`);
        expectedEnd.setHours(endH || 0, endM || 0, 0, 0);
        if (expectedEnd.getTime() <= expectedStart.getTime()) {
          expectedEnd = addDays(expectedEnd, 1);
        }

        const windowStart = addMinutes(expectedStart, -240);
        const windowEnd = addMinutes(expectedEnd, 300);

        const availablePunches = empGatePunches.filter(
          (p) =>
            !consumedPunchIds.has(p.id) &&
            p.punchTime >= windowStart &&
            p.punchTime <= windowEnd
        );

        const punchIn = availablePunches.length > 0 ? availablePunches[0] : null;
        // Only treat last punch as punchOut if there are >=2 punches separated by at least 15 minutes
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

        let status = "PRESENT";
        let lateMinutes = 0;
        let earlyExitMinutes = 0;
        let workedMinutes = 0;
        let overtimeMinutes = 0;
        const remarkParts: string[] = [];

        if (!punchIn) {
          if (isFuture || (isToday && isBefore(now, addMinutes(expectedStart, template.graceLate)))) {
            // Shift hasn't started yet today — skip marking absent prematurely
            continue;
          }
          status = "ABSENT";
          remarkParts.push("No Staff Gate punch recorded");
        } else {
          // Always evaluate lateness on punchIn!
          const lateCutoff = addMinutes(expectedStart, template.graceLate);
          const isLate = isAfter(punchIn.punchTime, lateCutoff);
          if (isLate) {
            lateMinutes = Math.max(
              0,
              differenceInMinutes(punchIn.punchTime, expectedStart)
            );
            remarkParts.push(`${lateMinutes}m late`);
          }

          if (!punchOut) {
            // Still on duty today (or shift ended recently) -> mark PRESENT or LATE!
            if (isToday || isBefore(now, addMinutes(expectedEnd, 180))) {
              status = isLate ? "LATE" : "PRESENT";
              workedMinutes = Math.max(
                0,
                differenceInMinutes(now, punchIn.punchTime)
              );
              remarkParts.push("On duty (clocked in)");
            } else {
              status = isLate ? "LATE" : "MISSING_PUNCH";
              remarkParts.push("Clocked in at Staff Gate; missing clock-out");
            }
          } else {
            workedMinutes = Math.max(
              0,
              differenceInMinutes(punchOut.punchTime, punchIn.punchTime)
            );
            const scheduledMinutes = Math.max(
              0,
              differenceInMinutes(expectedEnd, expectedStart)
            );

            status = isLate ? "LATE" : "PRESENT";

            if (
              isBefore(
                punchOut.punchTime,
                addMinutes(expectedEnd, -template.graceEarly)
              )
            ) {
              earlyExitMinutes = Math.max(
                0,
                differenceInMinutes(expectedEnd, punchOut.punchTime)
              );
              status = isLate ? "LATE_AND_EARLY" : "EARLY_EXIT";
              remarkParts.push(`${earlyExitMinutes}m early exit`);
            }

            if (workedMinutes > scheduledMinutes + 30) {
              overtimeMinutes = workedMinutes - scheduledMinutes;
            }
          }
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
          shiftTemplateId: template.id,
          shiftAssignmentId: assignment.id,
          sequence: assignment.sequence,
          actualIn: punchIn?.punchTime ?? null,
          actualOut: punchOut?.punchTime ?? null,
          workedMinutes,
          lateMinutes,
          earlyExitMinutes,
          overtimeMinutes,
          breakMinutes: template.breakMinutes || 60,
          status,
          remarks: remarkParts.join(" · ") || "Staff Gate verified",
        });
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
        ? Math.max(0, differenceInMinutes(punchOut.punchTime, punchIn.punchTime))
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
