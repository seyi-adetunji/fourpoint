/**
 * GET /api/reports/daily-attendance?date=YYYY-MM-DD[&deptId=N][&employeeId=N]
 *
 * Role access:
 *   HR_ADMIN / SUPER_ADMIN → all employees
 *   HOD                   → department scoped (token.departmentId)
 *   EMPLOYEE              → self only (token.employeeId)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getDailyAttendanceReport,
  summariseReport,
} from "@/services/dailyAttendanceService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as {
      role: string;
      employeeId?: number | null;
      departmentId?: number | null;
    };

    // ── Parse query params ────────────────────────────────────────────────
    const { searchParams } = req.nextUrl;
    const dateParam = searchParams.get("date");

    // Default to today if no date supplied
    const dateStr = dateParam || new Date().toISOString().split("T")[0];
    const date = new Date(dateStr); // midnight UTC

    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: "Invalid date parameter" }, { status: 400 });
    }

    // ── RBAC scoping ─────────────────────────────────────────────────────
    let filterDepartmentId: number | null = null;
    let filterEmployeeId: number | null   = null;

    const role = user.role;

    if (role === "EMPLOYEE") {
      // Employees can only see their own record
      if (!user.employeeId) {
        return NextResponse.json({ error: "No employee profile linked" }, { status: 403 });
      }
      filterEmployeeId = user.employeeId;
    } else if (role === "HOD") {
      // HOD sees their department only
      if (!user.departmentId) {
        return NextResponse.json({ error: "No department linked to this account" }, { status: 403 });
      }
      filterDepartmentId = user.departmentId;

      // Allow HOD to filter further if they supply a deptId query param that matches their own
      const deptParam = searchParams.get("deptId");
      if (deptParam && Number(deptParam) !== user.departmentId) {
        return NextResponse.json({ error: "Forbidden: cross-department access" }, { status: 403 });
      }
    } else if (["HR_ADMIN", "SUPER_ADMIN", "SUPERVISOR"].includes(role)) {
      // Full access — optionally honour deptId filter from query
      const deptParam = searchParams.get("deptId");
      if (deptParam) filterDepartmentId = Number(deptParam);

      const empParam = searchParams.get("employeeId");
      if (empParam) filterEmployeeId = Number(empParam);
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── Generate report ───────────────────────────────────────────────────
    const records = await getDailyAttendanceReport(
      date,
      filterDepartmentId,
      filterEmployeeId
    );

    const summary = summariseReport(records);

    // ── Serialise (Dates → ISO strings) ───────────────────────────────────
    const serialised = records.map((r) => ({
      employeeId:        r.employeeId,
      empCode:           r.empCode,
      name:              r.name,
      department:        r.department,
      departmentId:      r.departmentId,
      shiftStart:        r.shiftStart,
      shiftEnd:          r.shiftEnd,
      shiftTemplateName: r.shiftTemplateName,
      firstPunch:        r.firstPunch?.toISOString() ?? null,
      lastPunch:         r.lastPunch?.toISOString()  ?? null,
      durationMinutes:   r.durationMinutes,
      isShortShift:      r.isShortShift,
      status:            r.status,
      deviceUsed:        r.deviceUsed,
    }));

    return NextResponse.json({ date: dateStr, summary, records: serialised });
  } catch (error: any) {
    console.error("[daily-attendance] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 }
    );
  }
}
