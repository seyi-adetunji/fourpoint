import { endOfMonth, format } from "date-fns";

/**
 * Safely parses a date string (YYYY-MM-DD or ISO) or current local calendar date
 * into a true UTC midnight Date object (`YYYY-MM-DDT00:00:00.000Z`)
 * for strict comparison against Prisma `@db.Date` fields.
 *
 * Uses `format(new Date(), "yyyy-MM-dd")` when no argument is given so that
 * local hotel time between 00:00 and 01:00 WAT never rolls back to yesterday's UTC date.
 */
export function getUTCMidnight(dateString?: string | null): Date {
  const trimmed = dateString?.trim();
  const ymd =
    trimmed && /^\d{4}-\d{2}-\d{2}/.test(trimmed)
      ? trimmed.slice(0, 10)
      : format(new Date(), "yyyy-MM-dd");
  return new Date(`${ymd}T00:00:00.000Z`);
}

/**
 * Returns exact UTC midnight start & end `@db.Date` bounds for a `YYYY-MM` month string
 * (defaults to the current local month).
 */
export function getMonthRangeUTC(monthParam?: string | null): {
  monthStr: string;
  start: Date;
  end: Date;
} {
  const validMonth =
    monthParam && /^\d{4}-\d{2}$/.test(monthParam.trim())
      ? monthParam.trim()
      : format(new Date(), "yyyy-MM");
  const start = getUTCMidnight(`${validMonth}-01`);
  const lastDayLocal = endOfMonth(new Date(`${validMonth}-01T00:00:00`));
  const end = getUTCMidnight(format(lastDayLocal, "yyyy-MM-dd"));
  return { monthStr: validMonth, start, end };
}

/**
 * Calculates the total minutes between two "HH:mm" time strings.
 * Handles shifts that cross midnight.
 */
export function calculateMinutesBetweenTimes(
  startTime: string,
  endTime: string
): number {
  if (!startTime || !endTime) return 0;

  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  const startMinutes = (startH || 0) * 60 + (startM || 0);
  let endMinutes = (endH || 0) * 60 + (endM || 0);

  if (endMinutes <= startMinutes) {
    // Crosses midnight
    endMinutes += 24 * 60;
  }

  return endMinutes - startMinutes;
}
