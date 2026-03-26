import { AttendancePunch, ShiftAssignment, AttendanceResult, AttendanceException } from '@prisma/client';
import { differenceInMinutes, isBefore, isAfter, startOfDay, addMinutes, max, min, addDays } from 'date-fns';

type ProcessResult = Omit<AttendanceResult, 'id' | 'createdAt' | 'updatedAt'> & {
    exceptions: Omit<AttendanceException, 'id' | 'attendanceResultId' | 'createdAt' | 'updatedAt' | 'resolved' | 'resolvedBy' | 'resolvedAt'>[]
};

/**
 * Core attendance processing logic
 * 
 * Rules defined by requirements:
 * Shift A window: 07:00–16:00
 * Shift B window: 13:00–23:00
 * Night shift window: 21:00–08:00
 */
export function processAttendance(
    punches: AttendancePunch[],
    assignments: (ShiftAssignment & { shiftTemplate: any })[]
): ProcessResult[] {
    const results: ProcessResult[] = [];

    // Sort assignments by sequence to handle double shifts properly
    const sortedAssignments = [...assignments].sort((a, b) => a.sequence - b.sequence);
    
    // Sort punches chronologically
    const sortedPunches = [...punches].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    let remainingPunches = [...sortedPunches];

    for (const assignment of sortedAssignments) {
        const template = assignment.shiftTemplate;
        
        // Determine expected start and end times for this assignment
        const [startH, startM] = template.startTime.split(':').map(Number);
        const [endH, endM] = template.endTime.split(':').map(Number);
        
        const expectedStart = new Date(assignment.date);
        expectedStart.setHours(startH, startM, 0, 0);

        let expectedEnd = new Date(assignment.date);
        expectedEnd.setHours(endH, endM, 0, 0);

        if (template.code === 'N' || expectedEnd.getTime() < expectedStart.getTime()) {
            expectedEnd = addDays(expectedEnd, 1);
        }

        // Define valid matching windows based on shift type
        let windowStart = new Date(expectedStart);
        let windowEnd = new Date(expectedEnd);

        if (template.code === 'A') {
            windowStart.setHours(7, 0, 0, 0);
            windowEnd.setHours(16, 0, 0, 0);
        } else if (template.code === 'B') {
            windowStart.setHours(13, 0, 0, 0);
            windowEnd.setHours(23, 0, 0, 0);
        } else if (template.code === 'N') {
            windowStart.setHours(21, 0, 0, 0);
            windowEnd = addDays(new Date(assignment.date), 1);
            windowEnd.setHours(8, 0, 0, 0);
        } else {
            // Generic 2-hour window before/after for unknown shifts
            windowStart = addMinutes(expectedStart, -120);
            windowEnd = addMinutes(expectedEnd, 120);
        }

        // Find relevant punches within the window
        const windowPunches = remainingPunches.filter(p => 
            p.timestamp.getTime() >= windowStart.getTime() && 
            p.timestamp.getTime() <= windowEnd.getTime()
        );

        // Find the earliest IN and latest OUT in the window
        const punchInRaw = windowPunches.find(p => p.type === 'IN');
        const punchOutRaw = [...windowPunches].reverse().find(p => p.type === 'OUT');

        // Consume used punches so they aren't reused for the 2nd shift of a double shift
        if (punchInRaw) remainingPunches = remainingPunches.filter(p => p.id !== punchInRaw.id);
        if (punchOutRaw) remainingPunches = remainingPunches.filter(p => p.id !== punchOutRaw.id);

        const punchIn = punchInRaw?.timestamp || null;
        const punchOut = punchOutRaw?.timestamp || null;

        // Calculate late/early
        let minutesLate = 0;
        let minutesEarly = 0;
        let status = 'PRESENT';
        const exceptions: any[] = [];

        if (!punchIn && !punchOut) {
            status = 'NO_SHOW';
            exceptions.push({
                employeeId: assignment.employeeId,
                date: assignment.date,
                type: 'NO_SHOW',
                reason: 'No punches recorded for assigned shift'
            });
        } else if (!punchIn || !punchOut) {
            status = 'MISSING_PUNCH';
            exceptions.push({
                employeeId: assignment.employeeId,
                date: assignment.date,
                type: 'MISSING_PUNCH',
                reason: `Missing ${!punchIn ? 'IN' : 'OUT'} punch`
            });
        } else {
            // Both punches exist, calculate metrics
            if (isAfter(punchIn, addMinutes(expectedStart, template.graceLate))) {
                minutesLate = differenceInMinutes(punchIn, expectedStart);
                status = 'LATE';
                exceptions.push({
                    employeeId: assignment.employeeId,
                    date: assignment.date,
                    type: 'LATE_ARRIVAL',
                    reason: `${minutesLate} minutes late`
                });
            }

            if (isBefore(punchOut, addMinutes(expectedEnd, -template.graceEarly))) {
                minutesEarly = differenceInMinutes(expectedEnd, punchOut);
                status = status === 'LATE' ? 'LATE_AND_EARLY' : 'EARLY_EXIT';
                exceptions.push({
                    employeeId: assignment.employeeId,
                    date: assignment.date,
                    type: 'EARLY_EXIT',
                    reason: `${minutesEarly} minutes early`
                });
            }
        }

        results.push({
            employeeId: assignment.employeeId,
            shiftAssignmentId: assignment.id,
            date: assignment.date,
            punchIn,
            punchOut,
            status,
            minutesLate,
            minutesEarly,
            exceptions
        });
    }

    return results;
}
