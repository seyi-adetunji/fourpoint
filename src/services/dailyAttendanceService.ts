/**
 * dailyAttendanceService.ts
 * 
 * Attendance Intelligence Service
 * 
 * Reads:
 *   - public.att_manuallog       → raw biometric punches
 *   - public.personnel_employee  → employee roster
 *   - public.personnel_department → department names
 *   - public.att_device          → device aliases
 * 
 * Reads + uses as source of truth for shifts:
 *   - workforce.shift_assignments (via Prisma ShiftAssignment + ShiftTemplate)
 * 
 * NEVER writes to the public schema.
 */

import prisma from "@/lib/prisma";

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Minimum worked duration (in minutes) before a record is flagged as "short shift".
 * Default: 2 hours = 120 minutes.
 */
const SHORT_SHIFT_THRESHOLD_MINUTES = 120;

/**
 * Device aliases (partial, case-insensitive) considered valid entry/exit points.
 * Punches from other devices are ignored for status classification.
 */
const VALID_DEVICE_ALIASES = ["front", "entrance", "kitchen", "main", "lobby", "gate"];

// ─── Types ───────────────────────────────────────────────────────────────────

export type AttendanceStatus =
  | "ON_SHIFT_PRESENT"
  | "ON_SHIFT_ABSENT"
  | "OFF_SHIFT_PRESENT"
  | "NO_SHIFT_NO_PUNCH"; // employee exists but no context today

export interface DailyAttendanceRecord {
  employeeId: number;
  empCode: string;
  name: string;
  department: string;
  departmentId: number | null;
  shiftStart: string | null;   // "HH:MM" format
  shiftEnd: string | null;     // "HH:MM" format
  shiftTemplateName: string | null;
  firstPunch: Date | null;
  lastPunch: Date | null;
  durationMinutes: number | null;
  isShortShift: boolean;
  status: AttendanceStatus;
  deviceUsed: string | null;   // alias of device used for first punch
}

// ─── Raw DB types (from $queryRaw) ───────────────────────────────────────────

interface RawPunch {
  emp_id: number;
  checktime: Date;
  device_alias: string | null;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function isValidDevice(alias: string | null): boolean {
  if (!alias) return false;
  const lower = alias.toLowerCase();
  return VALID_DEVICE_ALIASES.some((keyword) => lower.includes(keyword));
}

function formatHHMM(time: string): string {
  // ShiftTemplate stores times as "HH:MM:SS" or "HH:MM"
  return time.substring(0, 5);
}

// ─── Main Service ─────────────────────────────────────────────────────────────

/**
 * getDailyAttendanceReport
 * 
 * Returns a classified attendance report for all active employees on the given date.
 * 
 * @param date - JS Date object for the day (time component ignored; full UTC day used)
 * @param filterDepartmentId - optional: restrict to a single department (for HOD role)
 * @param filterEmployeeId   - optional: restrict to a single employee (for EMPLOYEE self-view)
 */
export async function getDailyAttendanceReport(
  date: Date,
  filterDepartmentId?: number | null,
  filterEmployeeId?: number | null
): Promise<DailyAttendanceRecord[]> {
  // Build midnight-to-23:59:59 range in UTC for punch lookup
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setUTCHours(23, 59, 59, 999);

  // ── 1. Fetch all active employees (with department) ──────────────────────
  const employees = await prisma.employee.findMany({
    where: {
      isActive: true,
      ...(filterDepartmentId ? { departmentId: filterDepartmentId } : {}),
      ...(filterEmployeeId   ? { id: filterEmployeeId }            : {}),
    },
    include: { department: true },
    orderBy: { fullName: "asc" },
  });

  if (employees.length === 0) return [];

  const employeeIds = employees.map((e) => e.id);

  // ── 2. Fetch all punches for the day (raw SQL for cross-schema join) ──────
  // We join att_manuallog with att_device to get the device alias in one shot.
  // This avoids N+1 and keeps the public schema read-only.
  const rawPunches: RawPunch[] = await prisma.$queryRaw`
    SELECT
      ml.emp_id,
      ml.checktime,
      d.alias AS device_alias
    FROM
      public.att_manuallog ml
      LEFT JOIN public.att_device d ON d.id = ml.device_id
    WHERE
      ml.checktime >= ${dayStart}
      AND ml.checktime <= ${dayEnd}
      AND ml.emp_id = ANY(${employeeIds}::int[])
    ORDER BY
      ml.emp_id, ml.checktime ASC
  `;

  // ── 3. Filter to valid devices only ──────────────────────────────────────
  const validPunches = rawPunches.filter((p) => isValidDevice(p.device_alias));

  // ── 4. Group punches by employee ─────────────────────────────────────────
  const punchesByEmployee = new Map<number, RawPunch[]>();
  for (const punch of validPunches) {
    if (!punchesByEmployee.has(punch.emp_id)) {
      punchesByEmployee.set(punch.emp_id, []);
    }
    punchesByEmployee.get(punch.emp_id)!.push(punch);
  }

  // ── 5. Fetch shift assignments for the day (workforce schema) ─────────────
  const shiftAssignments = await prisma.shiftAssignment.findMany({
    where: {
      workDate: date,
      status: { not: "CANCELLED" },
      employeeId: { in: employeeIds },
    },
    include: { shiftTemplate: true },
  });

  // Group by employeeId (take first active assignment per employee)
  const shiftByEmployee = new Map<
    number,
    (typeof shiftAssignments)[number]
  >();
  for (const assignment of shiftAssignments) {
    if (!shiftByEmployee.has(assignment.employeeId)) {
      shiftByEmployee.set(assignment.employeeId, assignment);
    }
  }

  // ── 6. Classify each employee ─────────────────────────────────────────────
  const report: DailyAttendanceRecord[] = [];

  for (const employee of employees) {
    const punches = punchesByEmployee.get(employee.id) ?? [];
    const assignment = shiftByEmployee.get(employee.id) ?? null;

    const hasPunches  = punches.length > 0;
    const hasShift    = assignment !== null;

    // Determine first/last punch
    // punches are already sorted by checktime ASC per the SQL ORDER BY
    const firstPunch = hasPunches ? punches[0].checktime : null;
    const lastPunch  = hasPunches && punches.length > 1
      ? punches[punches.length - 1].checktime
      : firstPunch;  // single punch → first = last

    // Duration
    let durationMinutes: number | null = null;
    if (firstPunch && lastPunch && firstPunch !== lastPunch) {
      durationMinutes = Math.round(
        (lastPunch.getTime() - firstPunch.getTime()) / 60000
      );
    }

    const isShortShift =
      durationMinutes !== null && durationMinutes < SHORT_SHIFT_THRESHOLD_MINUTES;

    // Device alias of first punch
    const deviceUsed = hasPunches ? (punches[0].device_alias ?? null) : null;

    // Classification
    let status: AttendanceStatus;
    if (hasShift && hasPunches)  status = "ON_SHIFT_PRESENT";
    else if (hasShift && !hasPunches) status = "ON_SHIFT_ABSENT";
    else if (!hasShift && hasPunches) status = "OFF_SHIFT_PRESENT";
    else status = "NO_SHIFT_NO_PUNCH";

    report.push({
      employeeId:       employee.id,
      empCode:          employee.empCode,
      name:             `${employee.fullName}${employee.lastName ? " " + employee.lastName : ""}`.trim(),
      department:       employee.department?.name ?? "Unassigned",
      departmentId:     employee.departmentId ?? null,
      shiftStart:       assignment ? formatHHMM(assignment.shiftTemplate.startTime) : null,
      shiftEnd:         assignment ? formatHHMM(assignment.shiftTemplate.endTime)   : null,
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

// ─── Summary helper ───────────────────────────────────────────────────────────

export interface AttendanceSummary {
  total: number;
  onShiftPresent: number;
  onShiftAbsent: number;
  offShiftPresent: number;
  noContext: number;
}

export function summariseReport(records: DailyAttendanceRecord[]): AttendanceSummary {
  return {
    total:           records.length,
    onShiftPresent:  records.filter((r) => r.status === "ON_SHIFT_PRESENT").length,
    onShiftAbsent:   records.filter((r) => r.status === "ON_SHIFT_ABSENT").length,
    offShiftPresent: records.filter((r) => r.status === "OFF_SHIFT_PRESENT").length,
    noContext:       records.filter((r) => r.status === "NO_SHIFT_NO_PUNCH").length,
  };
}
