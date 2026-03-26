import prisma from "@/lib/prisma";
export const dynamic = "force-dynamic";
import { Users, Filter } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";

export default async function ShiftCoverageReport({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; deptId?: string }>;
}) {
  const params = await searchParams;
  const date = params.date ? new Date(params.date) : new Date();
  const start = startOfDay(date);
  const end = endOfDay(date);

  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
  
  const assignments = await prisma.shiftAssignment.findMany({
    where: {
      workDate: { gte: start, lte: end },
      ...(params.deptId ? { employee: { departmentId: params.deptId } } : {}),
    },
    include: {
      employee: { include: { department: true } },
      shiftTemplate: true,
    },
  });

  // Group by shift
  const byShift: Record<string, typeof assignments> = {};
  assignments.forEach(a => {
    const key = a.shiftTemplate.name;
    if (!byShift[key]) byShift[key] = [];
    byShift[key].push(a);
  });

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Shift Coverage Analysis</h1>
          <p className="page-subtitle">Staff distribution across shifts for {format(date, "PPP")}</p>
        </div>
      </div>

      <div className="card p-4 mb-6">
        <form className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase">Date</label>
            <input 
              type="date" 
              name="date" 
              defaultValue={params.date || format(new Date(), "yyyy-MM-dd")}
              className="input py-2" 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase">Department</label>
            <select name="deptId" className="input py-2" defaultValue={params.deptId || ""}>
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-primary py-2 px-4 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </form>
      </div>

      <div className="space-y-6">
        {Object.entries(byShift).length === 0 ? (
          <div className="card p-12 text-center text-muted-foreground">
            No shift assignments found for this selection.
          </div>
        ) : (
          Object.entries(byShift).map(([shiftName, staff]) => (
            <div key={shiftName}>
              <h2 className="text-lg font-bold text-primary mb-3 flex items-center gap-2">
                <Users className="w-5 h-5" />
                {shiftName} ({staff.length} staff)
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {staff.map(a => (
                  <div key={a.id} className="card p-3 border-l-4" style={{ borderLeftColor: a.shiftTemplate.color }}>
                    <p className="font-semibold text-sm">{a.employee.fullName}</p>
                    <p className="text-xs text-muted-foreground">{a.employee.designation}</p>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase font-medium">{a.employee.department?.name || "—"}</p>
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
