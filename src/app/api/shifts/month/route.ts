export const dynamic = "force-dynamic";

import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureShiftAssignmentsAccurate } from "@/lib/shiftIntegrity";

/**
 * GET /api/shifts/month?year=2026&month=4
 * Returns all active shift assignments for the given calendar month,
 * scoped to the caller's department when logged in as HOD/Supervisor.
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as any)?.role ?? "EMPLOYEE";
    const userDeptId = (session.user as any)?.departmentId as
      | number
      | null
      | undefined;
    const isDeptScoped = ["HOD", "DEPT_ADMIN", "SUPERVISOR"].includes(role);

    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") ?? "");
    const month = parseInt(searchParams.get("month") ?? ""); // 1-based

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { message: "Invalid year/month" },
        { status: 400 }
      );
    }

    await ensureShiftAssignmentsAccurate();

    // First and last day of the month (exact UTC midnight @db.Date)
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0));

    const assignments = await prisma.shiftAssignment.findMany({
      where: {
        workDate: { gte: start, lte: end },
        status: { not: "CANCELLED" },
        ...(isDeptScoped && userDeptId
          ? { employee: { departmentId: userDeptId } }
          : {}),
      },
      include: {
        shiftTemplate: { select: { name: true, color: true } },
      },
      orderBy: [{ workDate: "asc" }, { sequence: "asc" }],
    });

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

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (err) {
    console.error("[GET /api/shifts/month]", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
