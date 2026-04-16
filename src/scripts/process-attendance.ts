import prisma from "../lib/prisma";
import { startOfDay, addDays, addMinutes, differenceInMinutes, isAfter, isBefore, format } from "date-fns";

/**
 * PRODUCTION BACKGROUND PROCESSOR
 * Converts raw biometric punches into Attendance Results
 */
async function processAttendance(dateStr?: string) {
  const targetDate = startOfDay(dateStr ? new Date(dateStr) : new Date());
  console.log(`\n--- Processing Attendance for ${format(targetDate, 'yyyy-MM-dd')} ---`);

  try {
    // 1. Cleanup existing results for this date to prevent duplicates
    await prisma.attendanceException.deleteMany({ where: { workDate: targetDate } });
    await prisma.attendanceResult.deleteMany({ where: { workDate: targetDate } });

    // 2. Fetch assignments
    const assignments = await prisma.shiftAssignment.findMany({
      where: { workDate: targetDate, status: { not: 'CANCELLED' } },
      include: { shiftTemplate: true, employee: true },
    });

    if (assignments.length === 0) {
      console.log("No shifts assigned for this date.");
      return;
    }

    // 3. Fetch raw punches
    const punchWindowStart = addMinutes(targetDate, -180); // 3 hours before
    const punchWindowEnd = addDays(targetDate, 1);
    punchWindowEnd.setHours(8, 0, 0, 0); // up to 8am next day

    const allPunches = await prisma.iclockTransaction.findMany({
      where: {
        punchTime: { gte: punchWindowStart, lte: punchWindowEnd },
        empId: { in: assignments.map(a => a.employeeId) },
      },
      orderBy: { punchTime: "asc" },
    });

    console.log(`Found ${assignments.length} assignments and ${allPunches.length} raw punches.`);

    // 4. Group & Process
    for (const assignment of assignments) {
      const { shiftTemplate: template, employeeId } = assignment;
      
      // Calculate expected windows
      const [startH, startM] = template.startTime.split(":").map(Number);
      const [endH, endM] = template.endTime.split(":").map(Number);
      
      const expectedStart = new Date(targetDate); expectedStart.setHours(startH, startM, 0, 0);
      let expectedEnd = new Date(targetDate); expectedEnd.setHours(endH, endM, 0, 0);
      if (expectedEnd <= expectedStart) expectedEnd = addDays(expectedEnd, 1);

      // Define punch detection window
      const windowStart = addMinutes(expectedStart, -120);
      const windowEnd = addMinutes(expectedEnd, 120);

      const windowPunches = allPunches.filter(p => 
        p.empId === employeeId && 
        p.punchTime >= windowStart && 
        p.punchTime <= windowEnd
      );

      const punchIn = windowPunches.length > 0 ? windowPunches[0] : null;
      const punchOut = windowPunches.length > 1 ? windowPunches[windowPunches.length - 1] : null;

      let status = "PRESENT";
      let lateMinutes = 0;
      let earlyExitMinutes = 0;
      let workedMinutes = 0;
      let overtimeMinutes = 0;
      const breakMinutes = template.breakMinutes || 0;

      if (!punchIn && !punchOut) {
        status = "ABSENT";
      } else {
        if (punchIn && punchOut) {
          workedMinutes = Math.max(0, differenceInMinutes(punchOut.punchTime, punchIn.punchTime));
          
          if (isAfter(punchIn.punchTime, addMinutes(expectedStart, template.graceLate))) {
            lateMinutes = Math.max(0, differenceInMinutes(punchIn.punchTime, expectedStart));
            status = "LATE";
          }
          
          if (isBefore(punchOut.punchTime, addMinutes(expectedEnd, -template.graceEarly))) {
            earlyExitMinutes = Math.max(0, differenceInMinutes(expectedEnd, punchOut.punchTime));
            status = status === 'LATE' ? 'LATE_AND_EARLY' : 'EARLY_EXIT';
          }

          const scheduledMinutes = differenceInMinutes(expectedEnd, expectedStart);
          if (workedMinutes > scheduledMinutes + 30) {
            overtimeMinutes = workedMinutes - scheduledMinutes;
          }
        } else {
          status = "MISSING_PUNCH";
        }
      }

      await prisma.attendanceResult.create({
        data: {
          employeeId,
          workDate: targetDate,
          shiftTemplateId: template.id,
          shiftAssignmentId: assignment.id,
          sequence: assignment.sequence,
          actualIn: punchIn?.punchTime || null,
          actualOut: punchOut?.punchTime || null,
          workedMinutes,
          lateMinutes,
          earlyExitMinutes,
          overtimeMinutes,
          breakMinutes,
          status,
        }
      });
    }

    console.log(`Successfully processed ${assignments.length} records.`);
  } catch (err) {
    console.error("Critical error during processing:", err);
  } finally {
    await prisma.$disconnect();
  }
}

// Run for today
processAttendance();
