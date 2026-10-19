import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getUTCMidnight } from "@/lib/dateUtils";
import { ShiftListClient, type ShiftListRow } from "@/components/shifts/ShiftListClient";

export const dynamic = "force-dynamic";

/**
 * /shift-list — "Shift" menu
 * Displays all shifts grouped by department. Clicking a department reveals all shifts
 * in that department and allows exporting to Excel or PDF (per department or globally).
 */
export default async function ShiftListPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [sp, session] = await Promise.all([searchParams, getServerSession(authOptions)]);
  if (!session?.user) {
    redirect("/login");
  }

  const role = (session.user as any)?.role ?? "EMPLOYEE";
  const userDeptId = (session.user as any)?.departmentId as number | null | undefined;
  const isAdmin = ["SUPER_ADMIN", "HR_ADMIN"].includes(role);
  const isDeptScoped = ["HOD", "DEPT_ADMIN", "SUPERVISOR"].includes(role);

  if (!isAdmin && !isDeptScoped) {
    redirect("/unauthorized");
  }

  const str = (k: string) => (typeof sp?.[k] === "string" ? (sp[k] as string) : "");
  const q = str("q");
  const dept = str("dept");
  const creatorRole = str("creatorRole");
  const creator = str("creator");
  const from = str("from");
  const to = str("to");
  const status = str("status") || "ACTIVE";

  // ── Build filter ────────────────────────────────────────────────────────────
  const where: any = {};

  if (status === "ACTIVE") where.status = { not: "CANCELLED" };
  else if (status !== "ALL") where.status = status;

  if (from || to) {
    where.workDate = {
      ...(from ? { gte: getUTCMidnight(from) } : {}),
      ...(to ? { lte: getUTCMidnight(to) } : {}),
    };
  }

  const employeeFilter: any = {};
  if (isDeptScoped && userDeptId) {
    employeeFilter.departmentId = userDeptId;
  } else if (dept) {
    employeeFilter.departmentId = parseInt(dept);
  }

  if (q) {
    employeeFilter.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { empCode: { contains: q, mode: "insensitive" } },
    ];
  }
  if (Object.keys(employeeFilter).length) where.employee = employeeFilter;

  if (creator === "UNKNOWN") where.assignedByUserId = null;
  else if (creator) where.assignedByUserId = creator;
  else if (creatorRole) where.assignedBy = { role: creatorRole };

  // ── Queries ─────────────────────────────────────────────────────────────────
  const [assignments, departments, creators] = await Promise.all([
    prisma.shiftAssignment.findMany({
      where,
      include: {
        employee: { include: { department: true } },
        shiftTemplate: true,
        assignedBy: { select: { id: true, name: true, role: true, isActive: true } },
      },
      orderBy: [{ workDate: "desc" }, { employee: { fullName: "asc" } }, { sequence: "asc" }],
      take: 5000,
    }),
    prisma.department.findMany({
      where: isDeptScoped && userDeptId ? { id: userDeptId } : {},
      orderBy: { name: "asc" },
      select: { id: true, name: true, deptCode: true },
    }),
    prisma.user.findMany({
      where: { assignedShifts: { some: {} } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true, isActive: true },
    }),
  ]);

  const rows: ShiftListRow[] = assignments.map((a) => ({
    id: a.id,
    workDate: a.workDate.toISOString(),
    createdAt: a.createdAt.toISOString(),
    status: a.status,
    sequence: a.sequence,
    employeeName: a.employee.fullName,
    empCode: a.employee.empCode,
    departmentId: a.employee.departmentId ?? null,
    department: a.employee.department?.name ?? "Unassigned Department",
    shiftName: a.shiftTemplate.name,
    startTime: a.shiftTemplate.startTime,
    endTime: a.shiftTemplate.endTime,
    color: a.shiftTemplate.color,
    createdByName: a.assignedBy
      ? `${a.assignedBy.name}${a.assignedBy.isActive ? "" : " (deleted)"}`
      : null,
    createdByRole: a.assignedBy?.role ?? null,
  }));

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Shift</h1>
          <p className="page-subtitle">
            All shifts grouped by department — click any department to view its shifts and export to Excel or PDF
          </p>
        </div>
      </div>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <form className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              name="q"
              placeholder="Search staff name or ID..."
              defaultValue={q}
              className="input max-w-[200px]"
            />
            {isAdmin && (
              <select name="dept" defaultValue={dept} className="input max-w-[190px]">
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
            <select name="creatorRole" defaultValue={creatorRole} className="input max-w-[175px]">
              <option value="">Created by: All Roles</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="HR_ADMIN">HR Admin</option>
              <option value="HOD">HOD</option>
              <option value="DEPT_ADMIN">Dept Admin</option>
              <option value="SUPERVISOR">Supervisor</option>
            </select>
            {creators.length > 0 && (
              <select name="creator" defaultValue={creator} className="input max-w-[190px]">
                <option value="">Any Creator</option>
                {creators.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.role.replace(/_/g, " ")})
                  </option>
                ))}
              </select>
            )}
            <div className="flex items-center gap-1.5">
              <input type="date" name="from" defaultValue={from} className="input max-w-[140px]" />
              <span className="text-gray-400">to</span>
              <input type="date" name="to" defaultValue={to} className="input max-w-[140px]" />
            </div>
            <select name="status" defaultValue={status} className="input max-w-[165px]">
              <option value="ACTIVE">Active Shifts</option>
              <option value="ALL">All Statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <button type="submit" className="btn-primary btn-sm">
              Filter
            </button>
            <a href="/shift-list" className="btn-secondary btn-sm">
              Reset
            </a>
          </form>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground">
              {rows.length} total {rows.length === 1 ? "shift" : "shifts"} across{" "}
              {new Set(rows.map((r) => r.department)).size} department(s)
            </span>
          </div>
        </div>

        <ShiftListClient
          departments={departments}
          rows={rows}
          canDelete={isAdmin || isDeptScoped}
          initialSelectedDeptId={dept || (isDeptScoped && userDeptId ? String(userDeptId) : undefined)}
        />
      </div>
    </div>
  );
}
