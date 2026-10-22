/**
 * dailyAttendanceService.ts
 * 
 * Attendance Intelligence Service (Presence vs. Rota)
 * 
 * Reads:
 *   - public.iclock_transaction   → raw biometric punches
 *   - public.iclock_terminal      → terminal metadata (Staff Gate vs Canteen Device)
 *   - public.personnel_employee   → employee roster (note: is_active is false in ZKBioTime, so do NOT filter by isActive: true)
 *   - public.personnel_department → department names
 *   - workforce.ShiftAssignment   → scheduled shifts (Rota)
 */

import prisma from "@/lib/prisma";
import { classifyDevice } from "@/lib/attendanceProcessor";
import { addDays } from "date-fns";
import { getUTCMidnight } from "@/lib/dateUtils";

const SHORT_SHIFT_THRESHOLD_MINUTES = 120;

export type AttendanceStatus =
  | "ON_SHIFT_PRESENT"
  | "ON_SHIFT_ABSENT"
  | "OFF_SHIFT_PRESENT"
  | "NO_SHIFT_NO_PUNCH";

export interface DailyAttendanceRecord {
  key: string;
  workDate: string; // YYYY-MM-DD
  employeeId: number;
  empCode: string;
  name: string;
  department: string;
  departmentId: number | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  shiftTemplateName: string | null;
  firstPunch: Date | null;
  lastPunch: Date | null;
  canteenPunches: string[]; // HH:mm list of canteen punches on that date
  durationMinutes: number | null;
  isShortShift: boolean;
  status: AttendanceStatus;
  deviceUsed: string | null;
}

function formatHHMM(time: string): string {
  return time.substring(0, 5);
}

const STATUS_PRIORITY: Record<AttendanceStatus, number> = {
  ON_SHIFT_PRESENT: 1,
  ON_SHIFT_ABSENT: 2,
  OFF_SHIFT_PRESENT: 3,
  NO_SHIFT_NO_PUNCH: 4,
};

/**
 * Generates Presence vs. Rota Intelligence Report for a date or date range.
 */
export async function getDailyAttendanceReport(
  startDate: Date,
  filterDepartmentId?: number | null,
  filterEmployeeId?: number | null,
  endDate?: Date
): Promise<DailyAttendanceRecord[]> {
  const startUTC = getUTCMidnight(startDate.toISOString().slice(0, 10));
  const endUTC = endDate
    ? getUTCMidnight(endDate.toISOString().slice(0, 10))
    : startUTC;
  const rangeEndExclusive = addDays(endUTC, 1);
  const isSingleDay = startUTC.getTime() === endUTC.getTime();

  // 1. Fetch all employees (do NOT filter by isActive: true because ZKBioTime stores is_active = false)
  const employees = await prisma.employee.findMany({
    where: {
      ...(filterDepartmentId ? { departmentId: filterDepartmentId } : {}),
      ...(filterEmployeeId ? { id: filterEmployeeId } : {}),
    },
    include: { department: true },
    orderBy: { fullName: "asc" },
  });

  if (employees.length === 0) return [];

  const empById = new Map(employees.map((e) => [e.id, e]));
  const empByCode = new Map(employees.map((e) => [e.empCode, e]));
  const employeeIds = employees.map((e) => e.id);

  // 2. Fetch biometric punches in the date range
  const rawPunches = await prisma.iclockTransaction.findMany({
    where: {
      punchTime: { gte: startUTC, lt: rangeEndExclusive },
      OR: [
        { empId: { in: employeeIds } },
        { empCode: { in: Array.from(empByCode.keys()) } },
      ],
    },
    include: { terminal: true },
    orderBy: { punchTime: "asc" },
  });

  // Group punches by "empId|YYYY-MM-DD"
  const gatePunchesByEmpDay = new Map<
    string,
    { punchTime: Date; deviceLabel: string }[]
  >();
  const canteenPunchesByEmpDay = new Map<string, Date[]>();
  const activeDatesSet = new Set<string>();

  for (const p of rawPunches) {
    const emp =
      (p.empId ? empById.get(p.empId) : undefined) ??
      (p.empCode ? empByCode.get(p.empCode) : undefined);
    if (!emp) continue;

    const dateStr = p.punchTime.toISOString().slice(0, 10);
    const key = `${emp.id}|${dateStr}`;
    activeDatesSet.add(dateStr);

    const dev = classifyDevice(p);
    if (dev.category === "CANTEEN") {
      if (!canteenPunchesByEmpDay.has(key)) {
        canteenPunchesByEmpDay.set(key, []);
      }
      canteenPunchesByEmpDay.get(key)!.push(p.punchTime);
    } else {
      if (!gatePunchesByEmpDay.has(key)) {
        gatePunchesByEmpDay.set(key, []);
      }
      gatePunchesByEmpDay.get(key)!.push({
        punchTime: p.punchTime,
        deviceLabel: dev.label,
      });
    }
  }

  // 3. Fetch shift assignments in the date range
  const shiftAssignments = await prisma.shiftAssignment.findMany({
    where: {
      workDate: { gte: startUTC, lte: endUTC },
      status: { not: "CANCELLED" },
      employeeId: { in: employeeIds },
    },
    include: { shiftTemplate: true },
    orderBy: [{ workDate: "desc" }, { sequence: "asc" }],
  });

  const shiftByEmpDay = new Map<string, (typeof shiftAssignments)[number]>();
  for (const a of shiftAssignments) {
    const dateStr = a.workDate.toISOString().slice(0, 10);
    const key = `${a.employeeId}|${dateStr}`;
    activeDatesSet.add(dateStr);
    if (!shiftByEmpDay.has(key)) {
      shiftByEmpDay.set(key, a);
    }
  }

  const report: DailyAttendanceRecord[] = [];

  if (isSingleDay) {
    // Single-day mode: evaluate every employee in the selected scope for that date
    const dateStr = startUTC.toISOString().slice(0, 10);
    for (const employee of employees) {
      const key = `${employee.id}|${dateStr}`;
      const gatePunches = gatePunchesByEmpDay.get(key) ?? [];
      const canteenList = canteenPunchesByEmpDay.get(key) ?? [];
      const assignment = shiftByEmpDay.get(key) ?? null;

      // If no Staff Gate punch, check if they at least punched on Canteen Device
      const hasGatePunches = gatePunches.length > 0;
      const hasAnyPunches = hasGatePunches || canteenList.length > 0;
      const hasShift = assignment !== null;

      const firstPunch = hasGatePunches
        ? gatePunches[0].punchTime
        : canteenList.length > 0
        ? canteenList[0]
        : null;
      const lastPunch =
        hasGatePunches && gatePunches.length > 1
          ? gatePunches[gatePunches.length - 1].punchTime
          : firstPunch;

      let durationMinutes: number | null = null;
      if (firstPunch && lastPunch && firstPunch !== lastPunch) {
        durationMinutes = Math.round(
          (lastPunch.getTime() - firstPunch.getTime()) / 60000
        );
      }

      const isShortShift =
        durationMinutes !== null &&
        durationMinutes < SHORT_SHIFT_THRESHOLD_MINUTES;

      const deviceUsed = hasGatePunches
        ? gatePunches[0].deviceLabel
        : canteenList.length > 0
        ? "Canteen Device"
        : null;

      let status: AttendanceStatus;
      if (hasShift && hasAnyPunches) status = "ON_SHIFT_PRESENT";
      else if (hasShift && !hasAnyPunches) status = "ON_SHIFT_ABSENT";
      else if (!hasShift && hasAnyPunches) status = "OFF_SHIFT_PRESENT";
      else status = "NO_SHIFT_NO_PUNCH";

      report.push({
        key,
        workDate: dateStr,
        employeeId: employee.id,
        empCode: employee.empCode,
        name: `${employee.fullName}${employee.lastName ? " " + employee.lastName : ""}`.trim(),
        department: employee.department?.name ?? "Unassigned",
        departmentId: employee.departmentId ?? null,
        shiftStart: assignment
          ? formatHHMM(assignment.shiftTemplate.startTime)
          : null,
        shiftEnd: assignment
          ? formatHHMM(assignment.shiftTemplate.endTime)
          : null,
        shiftTemplateName: assignment?.shiftTemplate.name ?? null,
        firstPunch,
        lastPunch,
        canteenPunches: canteenList.map((d) => d.toISOString().slice(11, 16)),
        durationMinutes,
        isShortShift,
        status,
        deviceUsed,
      });
    }
  } else {
    // Multi-day range mode: evaluate all active (employee, date) pairs that have a shift OR a punch
    const allEmpDayKeys = new Set<string>([
      ...gatePunchesByEmpDay.keys(),
      ...canteenPunchesByEmpDay.keys(),
      ...shiftByEmpDay.keys(),
    ]);

    for (const key of allEmpDayKeys) {
      const [empIdStr, dateStr] = key.split("|");
      const employee = empById.get(Number(empIdStr));
      if (!employee) continue;

      const gatePunches = gatePunchesByEmpDay.get(key) ?? [];
      const canteenList = canteenPunchesByEmpDay.get(key) ?? [];
      const assignment = shiftByEmpDay.get(key) ?? null;

      const hasGatePunches = gatePunches.length > 0;
      const hasAnyPunches = hasGatePunches || canteenList.length > 0;
      const hasShift = assignment !== null;

      const firstPunch = hasGatePunches
        ? gatePunches[0].punchTime
        : canteenList.length > 0
        ? canteenList[0]
        : null;
      const lastPunch =
        hasGatePunches && gatePunches.length > 1
          ? gatePunches[gatePunches.length - 1].punchTime
          : firstPunch;

      let durationMinutes: number | null = null;
      if (firstPunch && lastPunch && firstPunch !== lastPunch) {
        durationMinutes = Math.round(
          (lastPunch.getTime() - firstPunch.getTime()) / 60000
        );
      }

      const isShortShift =
        durationMinutes !== null &&
        durationMinutes < SHORT_SHIFT_THRESHOLD_MINUTES;

      const deviceUsed = hasGatePunches
        ? gatePunches[0].deviceLabel
        : canteenList.length > 0
        ? "Canteen Device"
        : null;

      let status: AttendanceStatus;
      if (hasShift && hasAnyPunches) status = "ON_SHIFT_PRESENT";
      else if (hasShift && !hasAnyPunches) status = "ON_SHIFT_ABSENT";
      else if (!hasShift && hasAnyPunches) status = "OFF_SHIFT_PRESENT";
      else status = "NO_SHIFT_NO_PUNCH";

      report.push({
        key,
        workDate: dateStr,
        employeeId: employee.id,
        empCode: employee.empCode,
        name: `${employee.fullName}${employee.lastName ? " " + employee.lastName : ""}`.trim(),
        department: employee.department?.name ?? "Unassigned",
        departmentId: employee.departmentId ?? null,
        shiftStart: assignment
          ? formatHHMM(assignment.shiftTemplate.startTime)
          : null,
        shiftEnd: assignment
          ? formatHHMM(assignment.shiftTemplate.endTime)
          : null,
        shiftTemplateName: assignment?.shiftTemplate.name ?? null,
        firstPunch,
        lastPunch,
        canteenPunches: canteenList.map((d) => d.toISOString().slice(11, 16)),
        durationMinutes,
        isShortShift,
        status,
        deviceUsed,
      });
    }
  }

  // Sort so active statuses (ON_SHIFT_PRESENT, ON_SHIFT_ABSENT, OFF_SHIFT_PRESENT) always appear at the top,
  // then by date descending, then by employee name
  report.sort((a, b) => {
    const pDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (pDiff !== 0) return pDiff;
    if (b.workDate !== a.workDate) return b.workDate.localeCompare(a.workDate);
    return a.name.localeCompare(b.name);
  });

  return report;
}

export interface AttendanceSummary {
  total: number;
  onShiftPresent: number;
  onShiftAbsent: number;
  offShiftPresent: number;
  noContext: number;
}

export function summariseReport(records: DailyAttendanceRecord[]): AttendanceSummary {
  return {
    total: records.length,
    onShiftPresent: records.filter((r) => r.status === "ON_SHIFT_PRESENT").length,
    onShiftAbsent: records.filter((r) => r.status === "ON_SHIFT_ABSENT").length,
    offShiftPresent: records.filter((r) => r.status === "OFF_SHIFT_PRESENT").length,
    noContext: records.filter((r) => r.status === "NO_SHIFT_NO_PUNCH").length,
  };
}
