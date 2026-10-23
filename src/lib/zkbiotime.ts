import prisma from "@/lib/prisma";

/**
 * Maps workforce ShiftTemplate names to ZKBioTime `att_timeinterval` IDs:
 *   - Morning (AM) Timetable → id 1
 *   - Afternoon (PM) Timetable → id 2
 */
export function resolveZKIntervalId(shiftTemplateName: string): number | null {
  const normalized = (shiftTemplateName || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.startsWith("morning") || normalized === "am") return 1;
  if (normalized.startsWith("afternoon") || normalized === "pm") return 2;
  return null;
}

export interface SyncEntry {
  employeeId: number;
  workDate: Date;
  shiftTemplateName: string;
}

/**
 * Inserts shift assignments into ZKBioTime's `public.att_temporaryschedule` table
 * so the canteen machine can dispense meal tickets.
 * Only Morning and Afternoon shifts are synced.
 */
export async function syncZKBioTimeInsert(entries: SyncEntry[]): Promise<void> {
  if (entries.length === 0) return;

  // Deduplicate by employeeId + date + intervalId
  const seen = new Set<string>();

  for (const entry of entries) {
    const intervalId = resolveZKIntervalId(entry.shiftTemplateName);
    if (intervalId === null) continue;

    const attDate = entry.workDate.toISOString().slice(0, 10);
    const key = `${entry.employeeId}|${attDate}|${intervalId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM public.att_temporaryschedule 
         WHERE employee_id = $1 AND att_date = $2 AND time_interval_id = $3`,
        entry.employeeId,
        attDate,
        intervalId
      );

      await prisma.$executeRawUnsafe(
        `INSERT INTO public.att_temporaryschedule 
         (create_time, change_time, status, att_date, employee_id, time_interval_id)
         VALUES (NOW(), NOW(), 0, $1, $2, $3)`,
        attDate,
        entry.employeeId,
        intervalId
      );
    } catch (err) {
      console.error(
        `[ZKBioTime Sync] Failed to insert schedule for emp ${entry.employeeId} on ${attDate}:`,
        err
      );
    }
  }
}

/**
 * Removes shift assignments from ZKBioTime's `public.att_temporaryschedule` table,
 * unless the employee still has another active shift on that date using the same interval.
 */
export async function syncZKBioTimeDelete(entries: SyncEntry[]): Promise<void> {
  if (entries.length === 0) return;

  const seen = new Set<string>();

  for (const entry of entries) {
    const intervalId = resolveZKIntervalId(entry.shiftTemplateName);
    if (intervalId === null) continue;

    const attDate = entry.workDate.toISOString().slice(0, 10);
    const key = `${entry.employeeId}|${attDate}|${intervalId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    try {
      // Check if employee still has an active shift on this date that maps to the same ZKBioTime interval
      const remainingOnDay = await prisma.shiftAssignment.findMany({
        where: {
          employeeId: entry.employeeId,
          workDate: new Date(`${attDate}T00:00:00.000Z`),
          status: { not: "CANCELLED" },
        },
        include: { shiftTemplate: { select: { name: true } } },
      });

      const stillNeedsInterval = remainingOnDay.some(
        (r) => resolveZKIntervalId(r.shiftTemplate.name) === intervalId
      );
      if (stillNeedsInterval) continue;

      await prisma.$executeRawUnsafe(
        `DELETE FROM public.att_temporaryschedule 
         WHERE employee_id = $1 AND att_date = $2 AND time_interval_id = $3`,
        entry.employeeId,
        attDate,
        intervalId
      );
    } catch (err) {
      console.error(
        `[ZKBioTime Sync] Failed to delete schedule for emp ${entry.employeeId} on ${attDate}:`,
        err
      );
    }
  }
}
