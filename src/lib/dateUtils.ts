/**
 * Safely parses a date string (YYYY-MM-DD) or current local date into a true UTC midnight Date object 
 * for strict comparison against Prisma @db.Date fields.
 * 
 * Prevents timezone shifting bugs caused by startOfDay(new Date()) which offsets dates based on server local time.
 */
export function getUTCMidnight(dateString?: string | null): Date {
  const str = dateString || new Date().toISOString().split('T')[0];
  return new Date(str);
}
