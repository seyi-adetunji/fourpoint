import prisma from "@/lib/prisma";

/**
 * Maps our workforce ShiftTemplate names to ZKBioTime att_timeinterval IDs.
 * Morning(AM) Timetable → id 1
 * Afternoon(PM) Timetable → id 2
 */
const SHIFT_NAME_TO_ZK_INTERVAL: Record<string, number> = {
  Morning: 1,
  Afternoon: 2,
};

interface SyncEntry {
  employeeId: number;
  workDate: Date;
  shiftTemplateName: string;
}

/**
 * Inserts shift assignments into ZKBioTime's att_temporaryschedule table
 * so the canteen machine can dispense meal tickets.
 * Only Morning and Afternoon shifts are synced.
 */
export async function syncZKBioTimeInsert(entries: SyncEntry[]): Promise<void> {
  const filtered = entries.filter(
    (e) => e.shiftTemplateName in SHIFT_NAME_TO_ZK_INTERVAL
  );
  if (filtered.length === 0) return;

  for (const entry of filtered) {
    const intervalId = SHIFT_NAME_TO_ZK_INTERVAL[entry.shiftTemplateName];
    // Format date as YYYY-MM-DD string for the DATE column
    const attDate = entry.workDate.toISOString().slice(0, 10);

    try {
      // First, remove any existing record for this employee+date+interval to avoid duplicates
      await prisma.$executeRawUnsafe(
        `DELETE FROM public.att_temporaryschedule 
         WHERE employee_id = $1 AND att_date = $2 AND time_interval_id = $3`,
        entry.employeeId,
        attDate,
        intervalId
      );

      // Insert the new schedule entry
      await prisma.$executeRawUnsafe(
        `INSERT INTO public.att_temporaryschedule 
         (create_time, change_time, status, att_date, employee_id, time_interval_id)
         VALUES (NOW(), NOW(), 0, $1, $2, $3)`,
        attDate,
        entry.employeeId,
        intervalId
      );
    } catch (err) {
      // Log but do not fail the entire operation if ZKBioTime sync fails
      console.error(
        `[ZKBioTime Sync] Failed to insert schedule for emp ${entry.employeeId} on ${attDate}:`,
        err
      );
    }
  }
}

/**
 * Removes shift assignments from ZKBioTime's att_temporaryschedule table.
 * Only Morning and Afternoon shifts are affected.
 */
export async function syncZKBioTimeDelete(entries: SyncEntry[]): Promise<void> {
  const filtered = entries.filter(
    (e) => e.shiftTemplateName in SHIFT_NAME_TO_ZK_INTERVAL
  );
  if (filtered.length === 0) return;

  for (const entry of filtered) {
    const intervalId = SHIFT_NAME_TO_ZK_INTERVAL[entry.shiftTemplateName];
    const attDate = entry.workDate.toISOString().slice(0, 10);

    try {
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
