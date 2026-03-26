import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { processAttendance } from '@/lib/attendance';
import { startOfDay, endOfDay } from 'date-fns';

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { dateString } = body; // expect YYYY-MM-DD
        
        if (!dateString) {
            return NextResponse.json({ error: 'dateString is required' }, { status: 400 });
        }

        const targetDate = new Date(dateString);
        if (isNaN(targetDate.getTime())) {
            return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
        }

        // Fetch assignments for the day
        const assignments = await prisma.shiftAssignment.findMany({
            where: {
                date: {
                    gte: startOfDay(targetDate),
                    lte: endOfDay(targetDate)
                }
            },
            include: {
                shiftTemplate: true
            }
        });

        // Fetch punches for the day (with padding for night shifts/early arrivals)
        const punchesDateStart = new Date(targetDate);
        punchesDateStart.setHours(-4, 0, 0, 0); // 4 hours before the day
        
        const punchesDateEnd = new Date(targetDate);
        punchesDateEnd.setHours(32, 0, 0, 0); // 8am next day

        const punches = await prisma.attendancePunch.findMany({
            where: {
                timestamp: {
                    gte: punchesDateStart,
                    lte: punchesDateEnd
                }
            }
        });

        // Process attendance
        const results = processAttendance(punches, assignments);

        // Save results to database in transaction
        const savedResults = await prisma.$transaction(async (tx) => {
            const processed = [];
            
            for (const result of results) {
                const { exceptions, ...resultData } = result;

                const savedResult = await tx.attendanceResult.upsert({
                    where: { shiftAssignmentId: resultData.shiftAssignmentId },
                    update: resultData,
                    create: resultData
                });

                // Clear old exceptions for this assignment
                await tx.attendanceException.deleteMany({
                    where: { attendanceResultId: savedResult.id }
                });

                // Save new exceptions
                if (exceptions && exceptions.length > 0) {
                    await tx.attendanceException.createMany({
                        data: exceptions.map(ex => ({
                            ...ex,
                            attendanceResultId: savedResult.id
                        }))
                    });
                }

                processed.push({ ...savedResult, exceptions });
            }

            return processed;
        });

        return NextResponse.json({ 
            message: 'Attendance processed successfully',
            processedCount: savedResults.length,
            results: savedResults
        });

    } catch (error: any) {
        console.error('Error processing attendance:', error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}
