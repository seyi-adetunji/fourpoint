import prisma from "@/lib/prisma";
export const dynamic = "force-dynamic";
import { format } from "date-fns";
import { getUTCMidnight } from "@/lib/dateUtils";
import AssignShiftModal from "@/components/AssignShiftModal";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ExportButtons } from "@/components/ExportButtons";
import { ShiftsTableClient } from "@/components/shifts/ShiftsTableClient";

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

  const isHOD = ["HOD", "DEPT_ADMIN", "SUPERVISOR"].includes(role);
  const isAdmin = ["SUPER_ADMIN", "HR_ADMIN"].includes(role);

  const selectedDate = resolvedSearchParams?.date
    ? getUTCMidnight(resolvedSearchParams.date as string)
    : getUTCMidnight();
  const endDateStr = resolvedSearchParams?.endDate as string | undefined;
  const endDate = endDateStr ? getUTCMidnight(endDateStr) : undefined;
  
  const q = resolvedSearchParams?.q as string | undefined;
  const statusFilter = resolvedSearchParams?.status as string | undefined;

  // Pagination parameters
  const page = resolvedSearchParams?.page ? parseInt(resolvedSearchParams.page as string) : 1;
  const pageSize = 20;

  const [shiftAssignments, employees] = await Promise.all([
    prisma.shiftAssignment.findMany({
      where: {
        ...(endDate 
          ? { workDate: { gte: selectedDate, lte: endDate } }
          : resolvedSearchParams?.date
          ? { workDate: selectedDate }
          : { workDate: { gte: selectedDate } }
        ),
        ...(isHOD && userDeptId ? { employee: { departmentId: userDeptId } } : {}),
        ...(q && {
          employee: {
            OR: [
              { fullName: { contains: q, mode: "insensitive" } },
              { empCode: { contains: q, mode: "insensitive" } },
            ]
          }
        }),
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
      // We limit to 5000 to prevent OOM on very large datasets
      take: 5000,
    }),
    prisma.employee.findMany({
      where: {
        ...(isHOD && userDeptId ? { departmentId: userDeptId } : {}),
      },
      orderBy: { fullName: "asc" },
      select: { id: true, empCode: true, fullName: true },
    }),
  ]);

  const exportData = shiftAssignments.map(a => ({
    date: format(a.workDate, "yyyy-MM-dd"),
    employee: a.employee.fullName,
    empCode: a.employee.empCode,
    department: a.employee.department?.name || "—",
    shift: a.shiftTemplate.name,
    time: a.shiftTemplate.startTime < "12:00" ? "AM" : "PM",
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
  const groups = new Map<GroupKey, any>();
  for (const a of shiftAssignments) {
    const dateStr = a.workDate.toISOString().slice(0, 10);
    const key: GroupKey = `${a.employeeId}|${dateStr}`;
    if (!groups.has(key)) {
      groups.set(key, {
        id: key, // unique group identifier
        employeeId: a.employeeId,
        workDate: a.workDate.toISOString(),
        employee: {
          fullName: a.employee.fullName,
          empCode: a.employee.empCode,
          department: a.employee.department ? { name: a.employee.department.name } : null,
        },
        assignments: []
      });
    }
    groups.get(key)!.assignments.push({
      id: a.id,
      status: a.status,
      sequence: a.sequence,
      shiftTemplateId: a.shiftTemplateId,
      shiftTemplate: {
        id: a.shiftTemplate.id,
        name: a.shiftTemplate.name,
        startTime: a.shiftTemplate.startTime,
        endTime: a.shiftTemplate.endTime,
        color: a.shiftTemplate.color,
      },
    });
  }
  const groupList = Array.from(groups.values());

  // Memory Pagination
  const totalItems = groupList.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedGroups = groupList.slice((page - 1) * pageSize, page * pageSize);

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
        />
      </div>



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
            
            <div className="relative">
              <input
                type="text"
                name="q"
                placeholder="Search name or ID..."
                defaultValue={q || ""}
                className="input max-w-[200px]"
              />
            </div>
            
            <select name="status" defaultValue={statusFilter || ""} className="input max-w-[180px]">
              <option value="">All Statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <button type="submit" className="btn-primary btn-sm">Search</button>
          </form>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {totalItems} employee-days 
              <span className="text-gray-400">({shiftAssignments.length} total shifts)</span>
            </span>
            <ExportButtons data={exportData} filename="rota_schedule" headers={exportHeaders} />
          </div>
        </div>

        <ShiftsTableClient
          groups={paginatedGroups}
          isAdmin={isAdmin}
          isHOD={isHOD}
          statusFilter={statusFilter}
          pagination={{ page, totalPages }}
        />
      </div>
    </div>
  );
}
