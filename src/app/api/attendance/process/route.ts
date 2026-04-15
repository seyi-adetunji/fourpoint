import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { startOfDay, addDays, addMinutes, differenceInMinutes, isAfter, isBefore } from "date-fns";

/**
 * Attendance Processing API
 * 
 * POST /api/attendance/process?date=YYYY-MM-DD
 * 
 * Reads shift assignments and raw punches for the given date,
 * processes them into attendance results with exception detection.
 * 
 * Supports:
 * - Single shift per day
 * - Double shifts (Shift A + Shift B) per employee per day
 * - Overlapping shift windows
 * - Missing punch, no show, late arrival, early exit, overtime detection
 */
export async function POST(req: NextRequest) {
  try {
    const dateParam = req.nextUrl.searchParams.get("date");
    if (!dateParam) {
      return NextResponse.json({ error: "date parameter required (YYYY-MM-DD)" }, { status: 400 });
    }

    const targetDate = startOfDay(new Date(dateParam));

    // Fetch all assignments for the date with shift templates
    const assignments = await prisma.shiftAssignment.findMany({
      where: { workDate: targetDate },
      include: { shiftTemplate: true, employee: true },
      orderBy: [{ employeeId: "asc" }, { sequence: "asc" }],
    });

    // Fetch all punches for the date range
    const punchWindowStart = addMinutes(targetDate, -180);
    const punchWindowEnd = addDays(targetDate, 1);
    punchWindowEnd.setHours(8, 0, 0, 0);

    const allPunches = await prisma.iclockTransaction.findMany({
      where: {
        punchTime: { gte: punchWindowStart, lte: punchWindowEnd },
        empId: { in: [...new Set(assignments.map(a => a.employeeId))] } as any,
      },
      orderBy: { punchTime: "asc" },
    });

    let processedCount = 0;
    let exceptionsCount = 0;

    // Group assignments by employee
    const employeeAssignments = new Map<number, typeof assignments>();
    for (const a of assignments) {
      const existing = employeeAssignments.get(a.employeeId) || [];
      existing.push(a);
      employeeAssignments.set(a.employeeId, existing);
    }

    for (const [employeeId, empAssignments] of employeeAssignments) {
      let remainingPunches = allPunches
        .filter(p => p.empId === employeeId)
        .sort((a, b) => a.punchTime.getTime() - b.punchTime.getTime());

      const sortedAssignments = empAssignments.sort((a, b) => a.sequence - b.sequence);

      for (const assignment of sortedAssignments) {
        const template = assignment.shiftTemplate;
        const [startH, startM] = template.startTime.split(":").map(Number);
        const [endH, endM] = template.endTime.split(":").map(Number);

        const expectedStart = new Date(targetDate);
        expectedStart.setHours(startH, startM, 0, 0);

        let expectedEnd = new Date(targetDate);
        expectedEnd.setHours(endH, endM, 0, 0);

        if (expectedEnd.getTime() <= expectedStart.getTime()) {
          expectedEnd = addDays(expectedEnd, 1);
        }

        // Shift windows
        let windowStart: Date, windowEnd: Date;
        switch (template.code) {
          case "A":
            windowStart = new Date(targetDate); windowStart.setHours(7, 0, 0, 0);
            windowEnd = new Date(targetDate); windowEnd.setHours(16, 0, 0, 0);
            break;
          case "B":
            windowStart = new Date(targetDate); windowStart.setHours(13, 0, 0, 0);
            windowEnd = new Date(targetDate); windowEnd.setHours(23, 0, 0, 0);
            break;
          case "N":
            windowStart = new Date(targetDate); windowStart.setHours(21, 0, 0, 0);
            windowEnd = addDays(new Date(targetDate), 1); windowEnd.setHours(8, 0, 0, 0);
            break;
          default:
            windowStart = addMinutes(expectedStart, -120);
            windowEnd = addMinutes(expectedEnd, 120);
        }

        const windowPunches = remainingPunches.filter(
          p => p.punchTime.getTime() >= windowStart.getTime() && p.punchTime.getTime() <= windowEnd.getTime()
        );

        const punchIn = windowPunches.length > 0 ? windowPunches[0] : null;
        const punchOut = windowPunches.length > 1 ? windowPunches[windowPunches.length - 1] : null;

        if (punchIn) remainingPunches = remainingPunches.filter(p => p.id !== punchIn.id);
        if (punchOut) remainingPunches = remainingPunches.filter(p => p.id !== punchOut.id);

        let status = "PRESENT";
        let lateMinutes = 0;
        let earlyExitMinutes = 0;
        let workedMinutes = 0;
        let overtimeMinutes = 0;
        let remarks = "";
        const exceptions: any[] = [];

        if (!punchIn && !punchOut) {
          status = "NO_SHOW";
          exceptions.push({ employeeId, workDate: targetDate, type: "NO_SHOW", details: `No punches for ${template.name}`, status: "PENDING" });
        } else if (!punchOut && punchIn) {
          status = "MISSING_PUNCH";
          workedMinutes = differenceInMinutes(expectedEnd, punchIn.punchTime);
          exceptions.push({ employeeId, workDate: targetDate, type: "MISSING_PUNCH", details: `Missing OUT for ${template.name}`, status: "PENDING" });
        } else if (punchIn && punchOut) {
          workedMinutes = Math.max(0, differenceInMinutes(punchOut.punchTime, punchIn.punchTime));
          const scheduledMinutes = differenceInMinutes(expectedEnd, expectedStart);

          if (isAfter(punchIn.punchTime, addMinutes(expectedStart, template.graceLate))) {
            lateMinutes = differenceInMinutes(punchIn.punchTime, expectedStart);
            status = "LATE";
            remarks = `${lateMinutes}m late`;
            exceptions.push({ employeeId, workDate: targetDate, type: "LATE_ARRIVAL", details: `${lateMinutes}m late for ${template.name}`, status: "PENDING" });
          }

          if (isBefore(punchOut.punchTime, addMinutes(expectedEnd, -template.graceEarly))) {
            earlyExitMinutes = differenceInMinutes(expectedEnd, punchOut.punchTime);
            status = status === "LATE" ? "LATE_AND_EARLY" : "EARLY_EXIT";
            remarks += `${remarks ? " | " : ""}${earlyExitMinutes}m early`;
            exceptions.push({ employeeId, workDate: targetDate, type: "EARLY_EXIT", details: `${earlyExitMinutes}m early from ${template.name}`, status: "PENDING" });
          }

          if (workedMinutes > scheduledMinutes + 30) {
            overtimeMinutes = workedMinutes - scheduledMinutes;
          }
        }

        // Create attendance result
        await prisma.attendanceResult.create({
          data: {
            employeeId: assignment.employeeId,
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
            status,
            remarks: remarks || null,
          }
        });
        processedCount++;

        for (const exc of exceptions) {
          await prisma.attendanceException.create({
            data: {
              ...exc,
              employeeId: assignment.employeeId,
            }
          });
          exceptionsCount++;
        }
      }
    }

    return NextResponse.json({ success: true, date: dateParam, processed: processedCount, exceptions: exceptionsCount });
  } catch (error: any) {
    console.error("Attendance processing error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
