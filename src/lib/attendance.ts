import { AttendancePunch, ShiftAssignment, AttendanceResult, AttendanceException } from '@prisma/client';
import { differenceInMinutes, isBefore, isAfter, startOfDay, addMinutes, max, min, addDays } from 'date-fns';

type ProcessResult = {
    employeeId: string;
    shiftAssignmentId: string;
    workDate: Date;
    actualIn: Date | null;
    actualOut: Date | null;
    status: string;
    lateMinutes: number;
    earlyExitMinutes: number;
    exceptions: any[];
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
    const sortedPunches = [...punches].sort((a, b) => a.punchTime.getTime() - b.punchTime.getTime());

    let remainingPunches = [...sortedPunches];

    for (const assignment of sortedAssignments) {
        const template = assignment.shiftTemplate;
        
        // Determine expected start and end times for this assignment
        const [startH, startM] = template.startTime.split(':').map(Number);
        const [endH, endM] = template.endTime.split(':').map(Number);
        
        const expectedStart = new Date(assignment.workDate);
        expectedStart.setHours(startH, startM, 0, 0);

        let expectedEnd = new Date(assignment.workDate);
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
            windowEnd = addDays(new Date(assignment.workDate), 1);
            windowEnd.setHours(8, 0, 0, 0);
        } else {
            // Generic 2-hour window before/after for unknown shifts
            windowStart = addMinutes(expectedStart, -120);
            windowEnd = addMinutes(expectedEnd, 120);
        }

        // Find relevant punches within the window
        const windowPunches = remainingPunches.filter(p => 
            p.punchTime.getTime() >= windowStart.getTime() && 
            p.punchTime.getTime() <= windowEnd.getTime()
        );

        // Find the earliest and latest punch in the window
        // We no longer rely on a 'type' field as it doesn't exist in the schema
        const punchInRaw = windowPunches.length > 0 ? windowPunches[0] : null;
        const punchOutRaw = windowPunches.length > 1 ? windowPunches[windowPunches.length - 1] : null;

        // Consume used punches so they aren't reused for the 2nd shift of a double shift
        if (punchInRaw) remainingPunches = remainingPunches.filter(p => p.id !== punchInRaw.id);
        if (punchOutRaw) remainingPunches = remainingPunches.filter(p => p.id !== punchOutRaw.id);

        const punchIn = punchInRaw?.punchTime || null;
        const punchOut = punchOutRaw?.punchTime || null;

        // Calculate late/early
        let lateMinutes = 0;
        let earlyExitMinutes = 0;
        let status = 'PRESENT';
        const exceptions: any[] = [];

        if (!punchIn && !punchOut) {
            status = 'NO_SHOW';
            exceptions.push({
                employeeId: assignment.employeeId,
                workDate: assignment.workDate,
                type: 'NO_SHOW',
                reason: 'No punches recorded for assigned shift'
            });
        } else if (!punchIn || !punchOut) {
            status = 'MISSING_PUNCH';
            exceptions.push({
                employeeId: assignment.employeeId,
                workDate: assignment.workDate,
                type: 'MISSING_PUNCH',
                reason: `Missing ${!punchIn ? 'IN' : 'OUT'} punch`
            });
        } else {
            // Both punches exist, calculate metrics
            if (isAfter(punchIn, addMinutes(expectedStart, template.graceLate))) {
                lateMinutes = differenceInMinutes(punchIn, expectedStart);
                status = 'LATE';
                exceptions.push({
                    employeeId: assignment.employeeId,
                    workDate: assignment.workDate,
                    type: 'LATE_ARRIVAL',
                    reason: `${lateMinutes} minutes late`
                });
            }

            if (isBefore(punchOut, addMinutes(expectedEnd, -template.graceEarly))) {
                earlyExitMinutes = differenceInMinutes(expectedEnd, punchOut);
                status = status === 'LATE' ? 'LATE_AND_EARLY' : 'EARLY_EXIT';
                exceptions.push({
                    employeeId: assignment.employeeId,
                    workDate: assignment.workDate,
                    type: 'EARLY_EXIT',
                    reason: `${earlyExitMinutes} minutes early`
                });
            }
        }

        results.push({
            employeeId: assignment.employeeId,
            shiftAssignmentId: assignment.id,
            workDate: assignment.workDate,
            actualIn: punchIn,
            actualOut: punchOut,
            status,
            lateMinutes,
            earlyExitMinutes,
            exceptions
        });
    }

    return results;
}
