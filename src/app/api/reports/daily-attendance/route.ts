/**
 * GET /api/reports/daily-attendance?date=YYYY-MM-DD[&endDate=YYYY-MM-DD][&deptId=N][&employeeId=N]
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { subDays } from "date-fns";
import { getUTCMidnight } from "@/lib/dateUtils";
import {
  getDailyAttendanceReport,
  summariseReport,
} from "@/services/dailyAttendanceService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as {
      role: string;
      employeeId?: number | null;
      departmentId?: number | null;
    };

    const { searchParams } = req.nextUrl;
    const dateParam = searchParams.get("date");
    const endDateParam = searchParams.get("endDate");

    let startDate: Date;
    let endDate: Date;

    if (dateParam) {
      startDate = getUTCMidnight(dateParam);
      endDate = endDateParam ? getUTCMidnight(endDateParam) : startDate;
    } else {
      // Auto-detect active window so initial page load always shows Presence vs Rota activity
      const today = getUTCMidnight();
      const [latestPunch, latestShift] = await Promise.all([
        prisma.iclockTransaction.findFirst({
          orderBy: { punchTime: "desc" },
          select: { punchTime: true },
        }),
        prisma.shiftAssignment.findFirst({
          where: { status: { not: "CANCELLED" } },
          orderBy: { workDate: "desc" },
          select: { workDate: true },
        }),
      ]);

      const punchDate = latestPunch
        ? getUTCMidnight(latestPunch.punchTime.toISOString().slice(0, 10))
        : today;
      const shiftDate = latestShift
        ? getUTCMidnight(latestShift.workDate.toISOString().slice(0, 10))
        : today;

      const maxDate = punchDate > shiftDate ? punchDate : shiftDate;
      const minAnchor = punchDate < shiftDate ? punchDate : shiftDate;
      endDate = maxDate > today ? maxDate : today;
      startDate = getUTCMidnight(
        subDays(minAnchor, 14).toISOString().slice(0, 10)
      );
    }

    // RBAC scoping
    let filterDepartmentId: number | null = null;
    let filterEmployeeId: number | null = null;

    const role = user.role;

    if (role === "EMPLOYEE") {
      if (!user.employeeId) {
        return NextResponse.json(
          { error: "No employee profile linked" },
          { status: 403 }
        );
      }
      filterEmployeeId = user.employeeId;
    } else if (["HOD", "DEPT_ADMIN", "SUPERVISOR"].includes(role)) {
      if (user.departmentId) {
        filterDepartmentId = user.departmentId;
      }
    } else if (["HR_ADMIN", "SUPER_ADMIN"].includes(role)) {
      const deptParam = searchParams.get("deptId");
      if (deptParam) filterDepartmentId = Number(deptParam);

      const empParam = searchParams.get("employeeId");
      if (empParam) filterEmployeeId = Number(empParam);
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [records, departments] = await Promise.all([
      getDailyAttendanceReport(
        startDate,
        filterDepartmentId,
        filterEmployeeId,
        endDate
      ),
      prisma.department.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    const summary = summariseReport(records);

    const serialised = records.map((r) => ({
      key: r.key,
      workDate: r.workDate,
      employeeId: r.employeeId,
      empCode: r.empCode,
      name: r.name,
      department: r.department,
      departmentId: r.departmentId,
      shiftStart: r.shiftStart,
      shiftEnd: r.shiftEnd,
      shiftTemplateName: r.shiftTemplateName,
      firstPunch: r.firstPunch?.toISOString() ?? null,
      lastPunch: r.lastPunch?.toISOString() ?? null,
      canteenPunches: r.canteenPunches,
      durationMinutes: r.durationMinutes,
      isShortShift: r.isShortShift,
      status: r.status,
      deviceUsed: r.deviceUsed,
    }));

    return NextResponse.json({
      date: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
      departments,
      summary,
      records: serialised,
    });
  } catch (error: any) {
    console.error("[daily-attendance] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 }
    );
  }
}
