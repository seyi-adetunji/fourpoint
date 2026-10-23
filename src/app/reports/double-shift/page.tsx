import prisma from "@/lib/prisma";
export const dynamic = "force-dynamic";
import { Layers, Filter } from "lucide-react";
import { format } from "date-fns";
import { getUTCMidnight } from "@/lib/dateUtils";
import { ensureShiftAssignmentsAccurate } from "@/lib/shiftIntegrity";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function DoubleShiftReport({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; deptId?: string }>;
}) {
  const params = await searchParams;
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role ?? "EMPLOYEE";
  const userDeptId = (session?.user as any)?.departmentId as
    | number
    | null
    | undefined;
  const isDeptScoped = ["HOD", "DEPT_ADMIN", "SUPERVISOR"].includes(role);

  await ensureShiftAssignmentsAccurate();

  const targetDate = getUTCMidnight(params.date as string | undefined);
  const effectiveDeptId = isDeptScoped
    ? userDeptId ?? undefined
    : params.deptId
    ? Number(params.deptId)
    : undefined;

  const [departments, assignments] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.shiftAssignment.findMany({
      where: {
        workDate: targetDate,
        status: { not: "CANCELLED" },
        ...(effectiveDeptId
          ? { employee: { departmentId: effectiveDeptId } }
          : {}),
      },
      include: {
        employee: { include: { department: true } },
        shiftTemplate: true,
      },
      orderBy: [{ employee: { fullName: "asc" } }, { sequence: "asc" }],
    }),
  ]);

  // Group active distinct shifts by employee
  const byEmployee: Record<string, { employee: any; shifts: any[] }> = {};
  assignments.forEach((a) => {
    if (!byEmployee[a.employeeId]) {
      byEmployee[a.employeeId] = { employee: a.employee, shifts: [] };
    }
    byEmployee[a.employeeId].shifts.push(a.shiftTemplate);
  });

  const doubleShifts = Object.values(byEmployee).filter(
    (x) => x.shifts.length > 1
  );

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Double Shift Report</h1>
          <p className="page-subtitle">
            Employees assigned multiple active shifts on{" "}
            {format(targetDate, "PPP")}
          </p>
        </div>
      </div>

      <div className="card p-4 mb-6">
        <form className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase">
              Date
            </label>
            <input
              type="date"
              name="date"
              defaultValue={
                params.date || targetDate.toISOString().slice(0, 10)
              }
              className="input py-2"
            />
          </div>
          {!isDeptScoped && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase">
                Department
              </label>
              <select
                name="deptId"
                className="input py-2"
                defaultValue={params.deptId || ""}
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            type="submit"
            className="btn btn-primary py-2 px-4 flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </form>
      </div>

      <div className="space-y-4">
        {doubleShifts.length === 0 ? (
          <div className="card p-12 text-center text-muted-foreground">
            No double shifts found for this selection.
          </div>
        ) : (
          doubleShifts.map(({ employee, shifts }) => (
            <div
              key={employee.id}
              className="card p-6 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-violet-50">
                  <Layers className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-primary">
                    {employee.fullName}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {employee.empCode}
                    {employee.designation ? ` • ${employee.designation}` : ""} •{" "}
                    {employee.department?.name || "—"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {shifts.map((s, idx) => (
                  <div
                    key={`${s.id}-${idx}`}
                    className="px-3 py-1 rounded-full text-[10px] font-bold text-white uppercase"
                    style={{ backgroundColor: s.color || "#6B7280" }}
                  >
                    {s.name} ({s.startTime}–{s.endTime})
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
