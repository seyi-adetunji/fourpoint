import prisma from "@/lib/prisma";
import { Layers, Filter } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";

export default async function DoubleShiftReport({
  searchParams,
}: {
  searchParams: { date?: string; deptId?: string };
}) {
  const date = searchParams.date ? new Date(searchParams.date) : new Date();
  const start = startOfDay(date);
  const end = endOfDay(date);

  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
  
  // Find employees with more than 1 assignment on the same day
  const assignments = await prisma.shiftAssignment.findMany({
    where: {
      workDate: { gte: start, lte: end },
      ...(searchParams.deptId ? { employee: { departmentId: searchParams.deptId } } : {}),
    },
    include: {
      employee: { include: { department: true } },
      shiftTemplate: true,
    },
  });

  // Group by employee
  const byEmployee: Record<string, { employee: any; shifts: any[] }> = {};
  assignments.forEach(a => {
    if (!byEmployee[a.employeeId]) {
      byEmployee[a.employeeId] = { employee: a.employee, shifts: [] };
    }
    byEmployee[a.employeeId].shifts.push(a.shiftTemplate);
  });

  const doubleShifts = Object.values(byEmployee).filter(x => x.shifts.length > 1);

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Double Shift report</h1>
          <p className="page-subtitle">Employees assigned multiple shifts on {format(date, "PPP")}</p>
        </div>
      </div>

      <div className="card p-4 mb-6">
        <form className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase">Date</label>
            <input type="date" name="date" defaultValue={searchParams.date || format(new Date(), "yyyy-MM-dd")} className="input py-2" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase">Department</label>
            <select name="deptId" className="input py-2" defaultValue={searchParams.deptId || ""}>
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

      <div className="space-y-4">
        {doubleShifts.length === 0 ? (
          <div className="card p-12 text-center text-muted-foreground">
            No double shifts found for this selection.
          </div>
        ) : (
          doubleShifts.map(({ employee, shifts }) => (
            <div key={employee.id} className="card p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-violet-50">
                  <Layers className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-primary">{employee.fullName}</h3>
                  <p className="text-xs text-muted-foreground">{employee.designation} • {employee.department?.name || "—"}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {shifts.map(s => (
                  <div key={s.id} className="px-3 py-1 rounded-full text-[10px] font-bold text-white uppercase" style={{ backgroundColor: s.color }}>
                    {s.name}
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
