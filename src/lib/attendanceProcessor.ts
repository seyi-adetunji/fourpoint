import prisma from "@/lib/prisma";
import { addDays, addMinutes, differenceInMinutes, isAfter, isBefore } from "date-fns";
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
 * Synchronizes / computes `AttendanceResult` rows for a given UTC date range
 * using:
 *   1. Scheduled `ShiftAssignment` records (in `workforce.ShiftAssignment`)
 *   2. Biometric punches from `public.iclock_transaction` (separating Staff Gate vs Canteen)
 *
 * Also creates unscheduled `AttendanceResult` rows for employees who clocked in
 * at the Staff Gate without a shift assignment on that date, so Attendance Results
 * always reflects everyone who worked or was scheduled.
 */
export async function syncAttendanceResultsForRange(startDate: Date, endDate: Date) {
  const startUTC = getUTCMidnight(startDate.toISOString().slice(0, 10));
  const endUTC = getUTCMidnight(endDate.toISOString().slice(0, 10));

  // Fetch all shifts in [startUTC, endUTC]
  const assignments = await prisma.shiftAssignment.findMany({
    where: {
      workDate: { gte: startUTC, lte: endUTC },
      status: { not: "CANCELLED" },
    },
    include: { shiftTemplate: true, employee: true },
    orderBy: [{ workDate: "asc" }, { employeeId: "asc" }, { sequence: "asc" }],
  });

  // Fetch all punches in window [startUTC - 3h, endUTC + 1 day 8h]
  const punchWindowStart = addMinutes(startUTC, -180);
  const punchWindowEnd = addMinutes(addDays(endUTC, 1), 480);

  const rawPunches = await prisma.iclockTransaction.findMany({
    where: {
      punchTime: { gte: punchWindowStart, lte: punchWindowEnd },
    },
    include: { terminal: true, employee: true },
    orderBy: { punchTime: "asc" },
  });

  // Map empCode -> employeeId for any punches where empId is null
  const missingEmpCodes = Array.from(
    new Set(rawPunches.filter((p) => !p.empId && p.empCode).map((p) => p.empCode))
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

  // Separate Staff Gate punches from Canteen punches
  type NormalizedPunch = (typeof rawPunches)[number] & {
    resolvedEmpId: number | null;
    device: ClassifiedDevice;
  };

  const normalizedPunches: NormalizedPunch[] = rawPunches.map((p) => ({
    ...p,
    resolvedEmpId: p.empId ?? empByCode.get(p.empCode) ?? null,
    device: classifyDevice(p),
  }));

  const gatePunches = normalizedPunches.filter(
    (p) => p.resolvedEmpId != null && p.device.category === "STAFF_GATE"
  );
  const canteenPunches = normalizedPunches.filter(
    (p) => p.resolvedEmpId != null && p.device.category === "CANTEEN"
  );

  // Collect all distinct dates that have either a shift assignment or a gate punch
  const activeDateStrings = new Set<string>();
  for (const a of assignments) {
    activeDateStrings.add(a.workDate.toISOString().slice(0, 10));
  }
  for (const p of gatePunches) {
    const dStr = p.punchTime.toISOString().slice(0, 10);
    const dUTC = getUTCMidnight(dStr);
    if (dUTC >= startUTC && dUTC <= endUTC) {
      activeDateStrings.add(dStr);
    }
  }

  if (activeDateStrings.size === 0) {
    return { processed: 0 };
  }

  // Ensure a fallback ShiftTemplate exists for unscheduled Staff Gate attendance
  let defaultTemplate = await prisma.shiftTemplate.findFirst({
    orderBy: { startTime: "asc" },
  });
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
  }

  // Clear existing AttendanceResult rows in this date range that don't have manual corrections attached
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

  let processedCount = 0;

  for (const dateStr of Array.from(activeDateStrings).sort()) {
    const dayUTC = getUTCMidnight(dateStr);
    const nextDayUTC = addDays(dayUTC, 1);

    const dayAssignments = assignments.filter(
      (a) => a.workDate.toISOString().slice(0, 10) === dateStr
    );

    // Group assignments by employeeId
    const empAssignMap = new Map<number, typeof dayAssignments>();
    for (const a of dayAssignments) {
      const list = empAssignMap.get(a.employeeId) || [];
      list.push(a);
      empAssignMap.set(a.employeeId, list);
    }

    // Track which punch IDs were consumed by scheduled shifts
    const consumedPunchIds = new Set<number>();

    // 1. Process all employees with scheduled shifts on this day
    for (const [employeeId, empAssignments] of empAssignMap.entries()) {
      const empGatePunches = gatePunches.filter((p) => p.resolvedEmpId === employeeId);
      const empCanteenPunches = canteenPunches.filter(
        (p) =>
          p.resolvedEmpId === employeeId &&
          p.punchTime >= dayUTC &&
          p.punchTime < nextDayUTC
      );

      for (const assignment of empAssignments) {
        const template = assignment.shiftTemplate;
        const [startH, startM] = template.startTime.split(":").map(Number);
        const [endH, endM] = template.endTime.split(":").map(Number);

        const expectedStart = new Date(dayUTC);
        expectedStart.setUTCHours(startH || 0, startM || 0, 0, 0);

        let expectedEnd = new Date(dayUTC);
        expectedEnd.setUTCHours(endH || 0, endM || 0, 0, 0);
        if (expectedEnd.getTime() <= expectedStart.getTime()) {
          expectedEnd = addDays(expectedEnd, 1);
        }

        const windowStart = addMinutes(expectedStart, -180);
        const windowEnd = addMinutes(expectedEnd, 240);

        const availablePunches = empGatePunches.filter(
          (p) =>
            !consumedPunchIds.has(p.id) &&
            p.punchTime >= windowStart &&
            p.punchTime <= windowEnd
        );

        const punchIn = availablePunches.length > 0 ? availablePunches[0] : null;
        const punchOut =
          availablePunches.length > 1
            ? availablePunches[availablePunches.length - 1]
            : null;

        if (punchIn) consumedPunchIds.add(punchIn.id);
        if (punchOut) consumedPunchIds.add(punchOut.id);

        let status = "PRESENT";
        let lateMinutes = 0;
        let earlyExitMinutes = 0;
        let workedMinutes = 0;
        let overtimeMinutes = 0;
        const remarkParts: string[] = [];

        if (!punchIn && !punchOut) {
          status = "ABSENT";
          remarkParts.push("No Staff Gate punch recorded");
        } else if (punchIn && !punchOut) {
          status = "MISSING_PUNCH";
          remarkParts.push("Clocked in at Staff Gate; missing clock-out");
        } else if (punchIn && punchOut) {
          workedMinutes = Math.max(
            0,
            differenceInMinutes(punchOut.punchTime, punchIn.punchTime)
          );
          const scheduledMinutes = Math.max(
            0,
            differenceInMinutes(expectedEnd, expectedStart)
          );

          if (isAfter(punchIn.punchTime, addMinutes(expectedStart, template.graceLate))) {
            lateMinutes = Math.max(0, differenceInMinutes(punchIn.punchTime, expectedStart));
            status = "LATE";
            remarkParts.push(`${lateMinutes}m late`);
          }

          if (isBefore(punchOut.punchTime, addMinutes(expectedEnd, -template.graceEarly))) {
            earlyExitMinutes = Math.max(
              0,
              differenceInMinutes(expectedEnd, punchOut.punchTime)
            );
            status = status === "LATE" ? "LATE_AND_EARLY" : "EARLY_EXIT";
            remarkParts.push(`${earlyExitMinutes}m early exit`);
          }

          if (workedMinutes > scheduledMinutes + 30) {
            overtimeMinutes = workedMinutes - scheduledMinutes;
          }
        }

        if (empCanteenPunches.length > 0) {
          const canteenTimes = empCanteenPunches
            .map((c) => c.punchTime.toISOString().slice(11, 16))
            .join(", ");
          remarkParts.push(`Canteen: ${canteenTimes}`);
        }

        await prisma.attendanceResult.create({
          data: {
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
          },
        });
        processedCount++;
      }
    }

    // 2. Also process employees who punched at Staff Gate on this day WITHOUT a ShiftAssignment
    const unscheduledDayGatePunches = gatePunches.filter(
      (p) =>
        !consumedPunchIds.has(p.id) &&
        p.punchTime >= dayUTC &&
        p.punchTime < nextDayUTC &&
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
      const punchOut = empPunches.length > 1 ? empPunches[empPunches.length - 1] : null;
      const workedMinutes =
        punchIn && punchOut
          ? Math.max(0, differenceInMinutes(punchOut.punchTime, punchIn.punchTime))
          : 0;
      const status = punchOut ? "PRESENT" : "MISSING_PUNCH";

      const empCanteenPunches = canteenPunches.filter(
        (p) =>
          p.resolvedEmpId === employeeId &&
          p.punchTime >= dayUTC &&
          p.punchTime < nextDayUTC
      );

      const remarkParts: string[] = ["Unscheduled (Staff Gate)"];
      if (!punchOut) remarkParts.push("Single punch (no OUT)");
      if (empCanteenPunches.length > 0) {
        const canteenTimes = empCanteenPunches
          .map((c) => c.punchTime.toISOString().slice(11, 16))
          .join(", ");
        remarkParts.push(`Canteen: ${canteenTimes}`);
      }

      await prisma.attendanceResult.create({
        data: {
          employeeId,
          workDate: dayUTC,
          shiftTemplateId: defaultTemplate.id,
          shiftAssignmentId: null,
          sequence: 1,
          actualIn: punchIn.punchTime,
          actualOut: punchOut?.punchTime ?? null,
          workedMinutes,
          lateMinutes: 0,
          earlyExitMinutes: 0,
          overtimeMinutes: workedMinutes > 540 ? workedMinutes - 480 : 0,
          breakMinutes: 60,
          status,
          remarks: remarkParts.join(" · "),
        },
      });
      processedCount++;
    }
  }

  return { processed: processedCount };
}
