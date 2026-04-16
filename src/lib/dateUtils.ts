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

/**
 * Calculates the total minutes between two "HH:mm" time strings.
 * Handles shifts that cross midnight.
 */
export function calculateMinutesBetweenTimes(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  let startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;
  
  if (endMinutes < startMinutes) {
    // Crosses midnight
    endMinutes += 24 * 60;
  }
  
  return endMinutes - startMinutes;
}
