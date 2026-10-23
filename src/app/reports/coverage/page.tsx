import prisma from "@/lib/prisma";
export const dynamic = "force-dynamic";
import { Users, Filter } from "lucide-react";
import { format } from "date-fns";
import { getUTCMidnight } from "@/lib/dateUtils";
import { ensureShiftAssignmentsAccurate } from "@/lib/shiftIntegrity";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function ShiftCoverageReport({
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
      orderBy: [
        { shiftTemplate: { startTime: "asc" } },
        { employee: { fullName: "asc" } },
      ],
    }),
  ]);

  // Group by shift template
  const byShift: Record<string, typeof assignments> = {};
  assignments.forEach((a) => {
    const key = `${a.shiftTemplate.name} (${a.shiftTemplate.startTime} – ${a.shiftTemplate.endTime})`;
    if (!byShift[key]) byShift[key] = [];
    byShift[key].push(a);
  });

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Shift Coverage Analysis</h1>
          <p className="page-subtitle">
            Staff distribution across active shifts for{" "}
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

      <div className="space-y-6">
        {Object.entries(byShift).length === 0 ? (
          <div className="card p-12 text-center text-muted-foreground">
            No active shift assignments found for this selection.
          </div>
        ) : (
          Object.entries(byShift).map(([shiftName, staff]) => (
            <div key={shiftName}>
              <h2 className="text-lg font-bold text-primary mb-3 flex items-center gap-2">
                <Users className="w-5 h-5" />
                {shiftName} ({staff.length} staff)
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {staff.map((a) => (
                  <div
                    key={a.id}
                    className="card p-3 border-l-4"
                    style={{ borderLeftColor: a.shiftTemplate.color }}
                  >
                    <p className="font-semibold text-sm">
                      {a.employee.fullName}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {a.employee.empCode}
                      {a.employee.designation
                        ? ` · ${a.employee.designation}`
                        : ""}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase font-medium">
                      {a.employee.department?.name || "—"}
                    </p>
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
