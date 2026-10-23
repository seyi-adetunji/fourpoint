import prisma from "@/lib/prisma";
export const dynamic = "force-dynamic";
import { Filter, Zap, Clock, Users, Timer } from "lucide-react";
import { format } from "date-fns";
import { getMonthRangeUTC } from "@/lib/dateUtils";
import { syncAttendanceResultsForRange } from "@/lib/attendanceProcessor";
import { ExportButtons } from "@/components/ExportButtons";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function SummaryReport({
  searchParams,
}: {
  searchParams: Promise<{ empId?: string; month?: string }>;
}) {
  const params = await searchParams;
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role ?? "EMPLOYEE";
  const userDeptId = (session?.user as any)?.departmentId as
    | number
    | null
    | undefined;
  const isDeptScoped = ["HOD", "DEPT_ADMIN", "SUPERVISOR"].includes(role);

  const { monthStr, start, end } = getMonthRangeUTC(params.month);

  await syncAttendanceResultsForRange(start, end);

  const [employees, results, shiftAssignments] = await Promise.all([
    prisma.employee.findMany({
      where: {
        ...(isDeptScoped && userDeptId ? { departmentId: userDeptId } : {}),
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.attendanceResult.findMany({
      where: {
        workDate: { gte: start, lte: end },
        ...(params.empId ? { employeeId: Number(params.empId) } : {}),
        ...(isDeptScoped && userDeptId
          ? { employee: { departmentId: userDeptId } }
          : {}),
      },
      include: { employee: { include: { department: true } } },
    }),
    prisma.shiftAssignment.findMany({
      where: {
        workDate: { gte: start, lte: end },
        status: { not: "CANCELLED" },
        ...(params.empId ? { employeeId: Number(params.empId) } : {}),
        ...(isDeptScoped && userDeptId
          ? { employee: { departmentId: userDeptId } }
          : {}),
      },
      include: { employee: { include: { department: true } } },
    }),
  ]);

  // Accurate shift stats per employee: count total active shifts and actual double-shift days (>1 shift on same date)
  const shiftStats: Record<
    string,
    { total: number; doubleShifts: number; perDateCounts: Record<string, number> }
  > = {};

  const empMeta: Record<string, { name: string; dept: string }> = {};

  for (const s of shiftAssignments) {
    const empKey = String(s.employeeId);
    if (!empMeta[empKey]) {
      empMeta[empKey] = {
        name: s.employee.fullName,
        dept: s.employee.department?.name || "N/A",
      };
    }
    if (!shiftStats[empKey]) {
      shiftStats[empKey] = { total: 0, doubleShifts: 0, perDateCounts: {} };
    }
    shiftStats[empKey].total += 1;
    const dStr = s.workDate.toISOString().slice(0, 10);
    shiftStats[empKey].perDateCounts[dStr] =
      (shiftStats[empKey].perDateCounts[dStr] || 0) + 1;
  }

  for (const st of Object.values(shiftStats)) {
    st.doubleShifts = Object.values(st.perDateCounts).filter(
      (c) => c > 1
    ).length;
  }

  // Aggregate attendance per employee — only count days where employee actually clocked in (`actualIn !== null`)
  const empStats: Record<
    string,
    {
      name: string;
      dept: string;
      workedDates: Set<string>;
      late: number;
      early: number;
      ot: number;
      work: number;
    }
  > = {};

  for (const r of results) {
    const empKey = String(r.employeeId);
    if (!empMeta[empKey]) {
      empMeta[empKey] = {
        name: r.employee.fullName,
        dept: r.employee.department?.name || "N/A",
      };
    }
    if (!empStats[empKey]) {
      empStats[empKey] = {
        name: empMeta[empKey].name,
        dept: empMeta[empKey].dept,
        workedDates: new Set<string>(),
        late: 0,
        early: 0,
        ot: 0,
        work: 0,
      };
    }
    if (r.actualIn !== null) {
      empStats[empKey].workedDates.add(r.workDate.toISOString().slice(0, 10));
    }
    empStats[empKey].late += r.lateMinutes;
    empStats[empKey].early += r.earlyExitMinutes;
    empStats[empKey].ot += r.overtimeMinutes;
    empStats[empKey].work += r.workedMinutes;
  }

  // Ensure employees who have scheduled shifts this month (even if 0 punches yet) appear in the summary
  const allEmpKeys = Array.from(
    new Set([...Object.keys(empStats), ...Object.keys(shiftStats)])
  );

  const rows = allEmpKeys
    .map((empId) => {
      const s = empStats[empId];
      const meta = empMeta[empId] || { name: "Unknown", dept: "N/A" };
      return {
        empId,
        name: s?.name ?? meta.name,
        dept: s?.dept ?? meta.dept,
        days: s ? s.workedDates.size : 0,
        late: s?.late ?? 0,
        early: s?.early ?? 0,
        ot: s?.ot ?? 0,
        work: s?.work ?? 0,
        scheduledShifts: shiftStats[empId]?.total ?? 0,
        doubleShifts: shiftStats[empId]?.doubleShifts ?? 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Aggregated totals for KPIs
  const totalDays = rows.reduce((sum, r) => sum + r.days, 0);
  const totalLate = rows.reduce((sum, r) => sum + r.late, 0);
  const totalDbl = rows.reduce((sum, r) => sum + r.doubleShifts, 0);
  const totalOT = rows.reduce((sum, r) => sum + r.ot, 0);

  const kpis = [
    {
      label: "Total Work Days",
      value: totalDays,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Double Shifts",
      value: totalDbl,
      icon: Zap,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      label: "Late Minutes",
      value: `${totalLate}m`,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "OT Hours",
      value: `${Math.round(totalOT / 60)}h`,
      icon: Timer,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
  ];

  const exportHeaders = [
    { label: "Employee", key: "name" },
    { label: "Department", key: "dept" },
    { label: "Work Days", key: "days" },
    { label: "Scheduled Shifts", key: "scheduledShifts" },
    { label: "Double Shifts", key: "doubleShifts" },
    { label: "Late Minutes", key: "late" },
    { label: "Early Minutes", key: "early" },
    { label: "OT Minutes", key: "ot" },
    { label: "Total Hours", key: "workHrs" },
  ];

  const exportData = rows.map((r) => ({
    ...r,
    workHrs: (r.work / 60).toFixed(1),
  }));

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header justify-between">
        <div>
          <h1 className="page-title">Attendance Summary</h1>
          <p className="page-subtitle">
            Individual performance metrics for {format(start, "MMMM yyyy")}
          </p>
        </div>
        <ExportButtons
          data={exportData}
          filename={`payroll_summary_${monthStr}`}
          headers={exportHeaders}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="card p-4 flex items-center justify-between"
          >
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {k.label}
              </p>
              <p className={`text-xl font-black ${k.color}`}>{k.value}</p>
            </div>
            <div className={`p-2 rounded-lg ${k.bg}`}>
              <k.icon className={`w-4 h-4 ${k.color}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="card p-4 mb-6">
        <form className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase">
              Employee
            </label>
            <select
              name="empId"
              className="input py-2"
              defaultValue={params.empId || ""}
            >
              <option value="">All Employees</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase">
              Month
            </label>
            <input
              type="month"
              name="month"
              defaultValue={monthStr}
              className="input py-2"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary py-2 px-4 flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </form>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 font-bold text-gray-500 uppercase text-xs">
                Employee
              </th>
              <th className="px-4 py-3 font-bold text-gray-500 uppercase text-xs">
                Work Days
              </th>
              <th className="px-4 py-3 font-bold text-gray-500 uppercase text-xs">
                Scheduled
              </th>
              <th className="px-4 py-3 font-bold text-gray-500 uppercase text-xs">
                Dbl Shifts
              </th>
              <th className="px-4 py-3 font-bold text-gray-500 uppercase text-xs">
                Late (m)
              </th>
              <th className="px-4 py-3 font-bold text-gray-500 uppercase text-xs">
                Early Exit (m)
              </th>
              <th className="px-4 py-3 font-bold text-gray-500 uppercase text-xs">
                OT (m)
              </th>
              <th className="px-4 py-3 font-bold text-gray-500 uppercase text-xs">
                Work Hrs
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  No attendance or shift data found for this month.
                </td>
              </tr>
            ) : (
              rows.map((emp) => (
                <tr
                  key={emp.empId}
                  className="hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-primary">{emp.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">
                      {emp.dept}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-medium">{emp.days}</td>
                  <td className="px-4 py-3 text-blue-600 font-bold">
                    {emp.scheduledShifts}
                  </td>
                  <td className="px-4 py-3">
                    {emp.doubleShifts > 0 ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">
                        ⚡ {emp.doubleShifts}
                      </span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-amber-600 font-bold">
                    {emp.late}
                  </td>
                  <td className="px-4 py-3 text-orange-600 font-bold">
                    {emp.early}
                  </td>
                  <td className="px-4 py-3 text-blue-600 font-bold">
                    {emp.ot}
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {(emp.work / 60).toFixed(1)}h
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
