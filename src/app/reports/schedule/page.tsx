import prisma from "@/lib/prisma";
export const dynamic = "force-dynamic";
import { format, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { getUTCMidnight } from "@/lib/dateUtils";
import { Filter, Calendar } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function ShiftScheduleReport({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; deptId?: string; empId?: string }>;
}) {
  const params = await searchParams;
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role ?? "EMPLOYEE";
  const userDeptId = (session?.user as any)?.departmentId as string | undefined;

  // Date range — default to current week
  const today = getUTCMidnight();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const fromDate = params.from ? getUTCMidnight(params.from) : weekStart;
  const toDate = params.to ? getUTCMidnight(params.to) : weekEnd;

  // HOD: scope to own department
  const effectiveDeptId =
    role === "HOD" ? userDeptId : params.deptId ? Number(params.deptId) : undefined;

  const [departments, employees, assignments] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.employee.findMany({
      where: {
        isActive: true,
        ...(effectiveDeptId ? { departmentId: Number(effectiveDeptId) } : {}),
      },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, empCode: true },
    }),
    prisma.shiftAssignment.findMany({
      where: {
        workDate: { gte: fromDate, lte: toDate },
        ...(params.empId ? { employeeId: Number(params.empId) } : {}),
        ...(effectiveDeptId ? { employee: { departmentId: Number(effectiveDeptId) } } : {}),
      },
      include: {
        employee: { include: { department: true } },
        shiftTemplate: true,
      },
      orderBy: [{ workDate: "asc" }, { employee: { fullName: "asc" } }, { sequence: "asc" }],
    }),
  ]);

  // Stats
  const totalAssignments = assignments.length;
  const doubleShiftDays = assignments.filter((a) => a.sequence > 1).length;
  const uniqueEmployees = new Set(assignments.map((a) => a.employeeId)).size;
  const pendingApproval = assignments.filter((a) => a.status === "PENDING_APPROVAL").length;

  const STATUS_COLORS: Record<string, string> = {
    SCHEDULED: "bg-blue-50 text-blue-700 border-blue-200",
    CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    CANCELLED: "bg-red-50 text-red-700 border-red-200",
    PENDING_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
    SWAPPED: "bg-purple-50 text-purple-700 border-purple-200",
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Shift Schedule Report</h1>
          <p className="page-subtitle">
            {format(fromDate, "MMM d")} – {format(toDate, "MMM d, yyyy")}
            {effectiveDeptId && departments.find((d) => d.id === effectiveDeptId)
              ? ` · ${departments.find((d) => d.id === effectiveDeptId)?.name}`
              : ""}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <form className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase">From</label>
            <input
              type="date"
              name="from"
              defaultValue={params.from || format(weekStart, "yyyy-MM-dd")}
              className="input py-2"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase">To</label>
            <input
              type="date"
              name="to"
              defaultValue={params.to || format(weekEnd, "yyyy-MM-dd")}
              className="input py-2"
            />
          </div>
          {role !== "HOD" && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase">Department</label>
              <select name="deptId" className="input py-2" defaultValue={params.deptId || ""}>
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase">Employee</label>
            <select name="empId" className="input py-2" defaultValue={params.empId || ""}>
              <option value="">All Employees</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName} ({e.empCode})
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary py-2 px-4 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </form>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Assignments", value: totalAssignments, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Employees Scheduled", value: uniqueEmployees, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Double-Shift Slots", value: doubleShiftDays, color: "text-violet-600", bg: "bg-violet-50" },
          { label: "Pending Approval", value: pendingApproval, color: "text-amber-600", bg: "bg-amber-50" },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-4 flex items-center gap-3">
            <div className={`p-2 rounded-xl ${kpi.bg}`}>
              <Calendar className={`w-4 h-4 ${kpi.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-gray-50/30">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Date</th>
                <th className="px-5 py-3.5 font-semibold">Employee</th>
                <th className="px-5 py-3.5 font-semibold">Department</th>
                <th className="px-5 py-3.5 font-semibold">Shift</th>
                <th className="px-5 py-3.5 font-semibold">Timing</th>
                <th className="px-5 py-3.5 font-semibold text-center">Seq</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {assignments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">
                    No shift assignments found for this period.
                  </td>
                </tr>
              ) : (
                assignments.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-900 whitespace-nowrap">
                      {format(a.workDate, "EEE, MMM dd")}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-gray-900">{a.employee.fullName}</div>
                      <span className="text-xs text-muted-foreground font-mono">{a.employee.empCode}</span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{a.employee.department?.name || "—"}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border"
                        style={{
                          backgroundColor: (a.shiftTemplate.color || "#6b7280") + "18",
                          color: a.shiftTemplate.color || "#6b7280",
                          borderColor: (a.shiftTemplate.color || "#6b7280") + "35",
                        }}
                      >
                        {a.shiftTemplate.name}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs">
                      {a.shiftTemplate.startTime} – {a.shiftTemplate.endTime}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {a.sequence > 1 ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">
                          ⚡{a.sequence}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">{a.sequence}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_COLORS[a.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}
                      >
                        {a.status.replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
