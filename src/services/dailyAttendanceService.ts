/**
 * dailyAttendanceService.ts
 * 
 * Attendance Intelligence Service
 * 
 * Reads:
 *   - public.iclock_transaction  → raw biometric punches
 *   - public.iclock_terminal     → terminal metadata (Staff Gate vs Canteen Device)
 *   - public.personnel_employee  → employee roster
 *   - public.personnel_department → department names
 * 
 * Reads + uses as source of truth for shifts:
 *   - workforce.shift_assignments (via Prisma ShiftAssignment + ShiftTemplate)
 */

import prisma from "@/lib/prisma";
import { classifyDevice } from "@/lib/attendanceProcessor";

const SHORT_SHIFT_THRESHOLD_MINUTES = 120;

export type AttendanceStatus =
  | "ON_SHIFT_PRESENT"
  | "ON_SHIFT_ABSENT"
  | "OFF_SHIFT_PRESENT"
  | "NO_SHIFT_NO_PUNCH";

export interface DailyAttendanceRecord {
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
  durationMinutes: number | null;
  isShortShift: boolean;
  status: AttendanceStatus;
  deviceUsed: string | null;
}

function formatHHMM(time: string): string {
  return time.substring(0, 5);
}

export async function getDailyAttendanceReport(
  date: Date,
  filterDepartmentId?: number | null,
  filterEmployeeId?: number | null
): Promise<DailyAttendanceRecord[]> {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setUTCHours(23, 59, 59, 999);

  // 1. Fetch active employees
  const employees = await prisma.employee.findMany({
    where: {
      isActive: true,
      ...(filterDepartmentId ? { departmentId: filterDepartmentId } : {}),
      ...(filterEmployeeId ? { id: filterEmployeeId } : {}),
    },
    include: { department: true },
    orderBy: { fullName: "asc" },
  });

  if (employees.length === 0) return [];

  const employeeIds = employees.map((e) => e.id);
  const empByCode = new Map(employees.map((e) => [e.empCode, e.id]));

  // 2. Fetch biometric punches from iclock_transaction for the day
  const rawPunches = await prisma.iclockTransaction.findMany({
    where: {
      punchTime: { gte: dayStart, lte: dayEnd },
      OR: [
        { empId: { in: employeeIds } },
        { empCode: { in: Array.from(empByCode.keys()) } },
      ],
    },
    include: { terminal: true },
    orderBy: { punchTime: "asc" },
  });

  // 3. Filter to Staff Gate punches for attendance classification
  const punchesByEmployee = new Map<
    number,
    { punchTime: Date; deviceLabel: string }[]
  >();

  for (const p of rawPunches) {
    const dev = classifyDevice(p);
    if (dev.category !== "STAFF_GATE") continue;
    const empId = p.empId ?? empByCode.get(p.empCode);
    if (!empId) continue;

    if (!punchesByEmployee.has(empId)) {
      punchesByEmployee.set(empId, []);
    }
    punchesByEmployee.get(empId)!.push({
      punchTime: p.punchTime,
      deviceLabel: dev.label,
    });
  }

  // 4. Fetch shift assignments for the day
  const shiftAssignments = await prisma.shiftAssignment.findMany({
    where: {
      workDate: dayStart,
      status: { not: "CANCELLED" },
      employeeId: { in: employeeIds },
    },
    include: { shiftTemplate: true },
  });

  const shiftByEmployee = new Map<number, (typeof shiftAssignments)[number]>();
  for (const assignment of shiftAssignments) {
    if (!shiftByEmployee.has(assignment.employeeId)) {
      shiftByEmployee.set(assignment.employeeId, assignment);
    }
  }

  // 5. Classify each employee
  const report: DailyAttendanceRecord[] = [];

  for (const employee of employees) {
    const punches = punchesByEmployee.get(employee.id) ?? [];
    const assignment = shiftByEmployee.get(employee.id) ?? null;

    const hasPunches = punches.length > 0;
    const hasShift = assignment !== null;

    const firstPunch = hasPunches ? punches[0].punchTime : null;
    const lastPunch =
      hasPunches && punches.length > 1
        ? punches[punches.length - 1].punchTime
        : firstPunch;

    let durationMinutes: number | null = null;
    if (firstPunch && lastPunch && firstPunch !== lastPunch) {
      durationMinutes = Math.round(
        (lastPunch.getTime() - firstPunch.getTime()) / 60000
      );
    }

    const isShortShift =
      durationMinutes !== null && durationMinutes < SHORT_SHIFT_THRESHOLD_MINUTES;

    const deviceUsed = hasPunches ? punches[0].deviceLabel : null;

    let status: AttendanceStatus;
    if (hasShift && hasPunches) status = "ON_SHIFT_PRESENT";
    else if (hasShift && !hasPunches) status = "ON_SHIFT_ABSENT";
    else if (!hasShift && hasPunches) status = "OFF_SHIFT_PRESENT";
    else status = "NO_SHIFT_NO_PUNCH";

    report.push({
      employeeId: employee.id,
      empCode: employee.empCode,
      name: `${employee.fullName}${employee.lastName ? " " + employee.lastName : ""}`.trim(),
      department: employee.department?.name ?? "Unassigned",
      departmentId: employee.departmentId ?? null,
      shiftStart: assignment ? formatHHMM(assignment.shiftTemplate.startTime) : null,
      shiftEnd: assignment ? formatHHMM(assignment.shiftTemplate.endTime) : null,
      shiftTemplateName: assignment?.shiftTemplate.name ?? null,
      firstPunch,
      lastPunch,
      durationMinutes,
      isShortShift,
      status,
      deviceUsed,
    });
  }

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
