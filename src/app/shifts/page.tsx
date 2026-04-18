import prisma from "@/lib/prisma";
export const dynamic = "force-dynamic";
import { format } from "date-fns";
import { getUTCMidnight } from "@/lib/dateUtils";
import AssignShiftModal from "@/components/AssignShiftModal";
import GroupEditShiftModal from "@/components/GroupEditShiftModal";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ExportButtons } from "@/components/ExportButtons";
import { ShiftsTableClient } from "@/components/shifts/ShiftsTableClient";

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

  // Management roles that scope to own department
  const isHOD = role === "HOD" || role === "DEPT_ADMIN";
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

  const serializableGroups = groupList.map(group =>
    group.map(a => ({
      id: a.id,
      employeeId: a.employeeId,
      workDate: a.workDate.toISOString(),
      status: a.status,
      sequence: a.sequence,
      employee: {
        fullName: a.employee.fullName,
        empCode: a.employee.empCode,
        department: a.employee.department ? { name: a.employee.department.name } : null,
      },
      shiftTemplate: {
        name: a.shiftTemplate.name,
        startTime: a.shiftTemplate.startTime,
        endTime: a.shiftTemplate.endTime,
        color: a.shiftTemplate.color,
      },
    }))
  );

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

        <ShiftsTableClient
          initialGroups={serializableGroups}
          isAdmin={isAdmin}
          isHOD={isHOD}
          statusFilter={statusFilter}
        />
      </div>
    </div>
  );
}
