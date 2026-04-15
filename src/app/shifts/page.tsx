import prisma from "@/lib/prisma";
export const dynamic = "force-dynamic";
import { format } from "date-fns";
import { getUTCMidnight } from "@/lib/dateUtils";
import AssignShiftModal from "@/components/AssignShiftModal";
import GroupEditShiftModal from "@/components/GroupEditShiftModal";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ExportButtons } from "@/components/ExportButtons";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shiftCountLabel(count: number) {
  if (count === 1) return null;
  if (count === 2) return "Double Shift";
  if (count === 3) return "Triple Shift";
  return `×${count} Shift`;
}

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-blue-50 text-blue-700 border-blue-200",
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
  PENDING_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
  SWAPPED: "bg-purple-50 text-purple-700 border-purple-200",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [resolvedSearchParams, session] = await Promise.all([
    searchParams,
    getServerSession(authOptions),
  ]);

  const role = (session?.user as any)?.role ?? "EMPLOYEE";
  const userDeptId = (session?.user as any)?.departmentId as number | undefined;

  // HOD: scope to own department only
  const isHOD = role === "HOD";
  const isAdmin = ["SUPER_ADMIN", "HR_ADMIN"].includes(role);

  const selectedDate = resolvedSearchParams?.date
    ? getUTCMidnight(resolvedSearchParams.date as string)
    : getUTCMidnight();
  const endDateStr = resolvedSearchParams?.endDate as string | undefined;
  const endDate = endDateStr ? getUTCMidnight(endDateStr) : undefined;
  
  const selectedEmployeeId = resolvedSearchParams?.employee
    ? Number(resolvedSearchParams.employee)
    : undefined;
  const deptId = isHOD
    ? userDeptId
    : resolvedSearchParams?.department
    ? Number(resolvedSearchParams.department)
    : undefined;
  const statusFilter = resolvedSearchParams?.status as string | undefined;

  const [shiftAssignments, employees, departments] = await Promise.all([
    prisma.shiftAssignment.findMany({
      where: {
        ...(endDate 
          ? { workDate: { gte: selectedDate, lte: endDate } }
          : resolvedSearchParams?.date
          ? { workDate: selectedDate }
          : { workDate: { gte: selectedDate } }
        ),
        ...(selectedEmployeeId && { employeeId: selectedEmployeeId }),
        ...(deptId && { employee: { departmentId: deptId } }),
        ...(statusFilter && { status: statusFilter }),
      },
      include: {
        employee: { include: { department: true } },
        shiftTemplate: true,
      },
      orderBy: [
        { workDate: "asc" },
        { employee: { fullName: "asc" } },
        { sequence: "asc" },
      ],
      take: 500,
    }),
    prisma.employee.findMany({
      where: {
        ...(isHOD && userDeptId ? { departmentId: userDeptId } : {}),
      },
      orderBy: { fullName: "asc" },
      select: { id: true, empCode: true, fullName: true },
    }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  const exportData = shiftAssignments.map(a => ({
    date: format(a.workDate, "yyyy-MM-dd"),
    employee: a.employee.fullName,
    empCode: a.employee.empCode,
    department: a.employee.department?.name || "—",
    shift: a.shiftTemplate.name,
    time: `${a.shiftTemplate.startTime}–${a.shiftTemplate.endTime}`,
    status: a.status
  }));

  const exportHeaders = [
    { label: "Date", key: "date" },
    { label: "Employee", key: "employee" },
    { label: "Staff ID", key: "empCode" },
    { label: "Department", key: "department" },
    { label: "Shift", key: "shift" },
    { label: "Hours", key: "time" },
    { label: "Status", key: "status" },
  ];

  // Group by (employeeId + workDate)
  type GroupKey = string;
  const groups = new Map<GroupKey, typeof shiftAssignments>();
  for (const a of shiftAssignments) {
    const dateStr = a.workDate.toISOString().slice(0, 10);
    const key: GroupKey = `${a.employeeId}|${dateStr}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }
  const groupList = Array.from(groups.values());

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Shift Assignments</h1>
          <p className="page-subtitle">
            {isHOD
              ? "Your department's shift schedule — request multi-shifts for your team"
              : "Manage rota scheduling and staff assignments"}
          </p>
        </div>
        <AssignShiftModal
          employees={employees}
          requiresApproval={isHOD}
        />
      </div>

      {isHOD && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <span className="text-lg">⏳</span>
          <span>
            As a <strong>Head of Department</strong>, your shift requests will be sent to HR for approval before being confirmed.
          </span>
        </div>
      )}

      <div className="table-wrapper">
        <div className="table-toolbar">
          <form className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                name="date"
                defaultValue={format(selectedDate, "yyyy-MM-dd")}
                className="input max-w-[140px]"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                name="endDate"
                defaultValue={endDateStr || ""}
                placeholder="End Date"
                className="input max-w-[140px]"
              />
            </div>
            <select
              name="employee"
              defaultValue={selectedEmployeeId || ""}
              className="input max-w-[200px]"
            >
              <option value="">All Employees</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName} ({e.empCode})
                </option>
              ))}
            </select>
            {!isHOD && (
              <select
                name="department"
                defaultValue={deptId || ""}
                className="input max-w-[180px]"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
            <select name="status" defaultValue={statusFilter || ""} className="input max-w-[180px]">
              <option value="">All Statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <button type="submit" className="btn-primary btn-sm">Filter</button>
          </form>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {groupList.length} employee-days 
              <span className="text-gray-400">({shiftAssignments.length} total shifts)</span>
            </span>
            <ExportButtons data={exportData} filename="rota_schedule" headers={exportHeaders} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-gray-50/30">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Date</th>
                <th className="px-5 py-3.5 font-semibold">Employee</th>
                <th className="px-5 py-3.5 font-semibold">Department</th>
                <th className="px-5 py-3.5 font-semibold">Shifts</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
                {(isAdmin || isHOD) && (
                  <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {groupList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                    No shift assignments found. Click <strong>Assign Shift</strong> to get started.
                  </td>
                </tr>
              ) : (
                groupList.map((group) => {
                  const first = group[0];
                  const label = shiftCountLabel(group.length);
                  return (
                    <tr
                      key={`${first.employeeId}|${first.workDate.toISOString()}`}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-medium text-gray-900 whitespace-nowrap">
                        {format(first.workDate, "MMM dd, yyyy")}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-gray-900">{first.employee.fullName}</div>
                        <span className="text-xs text-muted-foreground font-mono">{first.employee.empCode}</span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">
                        {first.employee.department?.name || "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1">
                          {group.length > 1 && (
                            <span className="inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200 mb-0.5">
                              <span>⚡</span> {label}
                            </span>
                          )}
                          {group.map((a) => (
                            <div key={a.id} className="flex items-center gap-1.5">
                              {group.length > 1 && (
                                <span className="shrink-0 w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-bold bg-gray-200 text-gray-500">
                                  {a.sequence}
                                </span>
                              )}
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
                              <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">
                                {a.shiftTemplate.startTime}–{a.shiftTemplate.endTime}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          {group.map((a) => (
                            <span
                              key={a.id}
                              className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border w-fit ${STATUS_STYLES[a.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}
                            >
                              {a.status.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      </td>
                      {(isAdmin || isHOD) && (
                        <td className="px-5 py-3.5 text-right">
                          <GroupEditShiftModal assignments={group} readOnly={isHOD} />
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
