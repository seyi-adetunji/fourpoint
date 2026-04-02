import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/shifts/month?year=2026&month=4
 * Returns all shift assignments for the given calendar month.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") ?? "");
    const month = parseInt(searchParams.get("month") ?? ""); // 1-based

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ message: "Invalid year/month" }, { status: 400 });
    }

    // First and last day of the month (UTC)
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const assignments = await prisma.shiftAssignment.findMany({
      where: {
        workDate: { gte: start, lte: end },
      },
      include: {
        shiftTemplate: { select: { name: true, color: true } },
      },
      orderBy: [{ workDate: "asc" }, { sequence: "asc" }],
    });

    // Return a simplified payload
    const payload = assignments.map((a) => ({
      id: a.id,
      employeeId: a.employeeId,
      workDate: a.workDate.toISOString(),
      sequence: a.sequence,
      shiftTemplate: {
        name: a.shiftTemplate.name,
        color: a.shiftTemplate.color,
      },
    }));

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[GET /api/shifts/month]", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
