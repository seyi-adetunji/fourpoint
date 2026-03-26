import prisma from "@/lib/prisma";
import { Building2, Filter, PieChart } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

export default async function DepartmentSummaryReport({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const monthStr = searchParams.month || format(new Date(), "yyyy-MM");
  const start = startOfMonth(new Date(monthStr));
  const end = endOfMonth(new Date(monthStr));

  const departments = await prisma.department.findMany({
    include: {
      _count: { select: { employees: true } },
    },
    orderBy: { name: "asc" },
  });

  // Aggregated data per department
  const stats = await Promise.all(departments.map(async (dept) => {
    const [absences, lateComings, earlyExits] = await Promise.all([
      prisma.attendanceException.count({ 
        where: { employee: { departmentId: dept.id }, type: "NO_SHOW", workDate: { gte: start, lte: end } } 
      }),
      prisma.attendanceResult.count({ 
        where: { employee: { departmentId: dept.id }, lateArrival: { gt: 0 }, workDate: { gte: start, lte: end } } 
      }),
      prisma.attendanceResult.count({ 
        where: { employee: { departmentId: dept.id }, earlyExit: { gt: 0 }, workDate: { gte: start, lte: end } } 
      }),
    ]);

    return {
      ...dept,
      absences,
      lateComings,
      earlyExits,
      totalExceptions: absences + lateComings + earlyExits
    };
  }));

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Department Summary</h1>
          <p className="page-subtitle">Multi-department performance metrics for {format(start, "MMMM yyyy")}</p>
        </div>
      </div>

      <div className="card p-4 mb-6">
        <form className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase">Month</label>
            <input type="month" name="month" defaultValue={monthStr} className="input py-2" />
          </div>
          <button type="submit" className="btn btn-primary py-2 px-4 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(dept => (
          <div key={dept.id} className="card p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-cyan-50">
                  <Building2 className="w-5 h-5 text-cyan-600" />
                </div>
                <span className="text-xs font-mono font-bold text-gray-400">#{dept.code}</span>
              </div>
              <h3 className="font-bold text-primary text-lg">{dept.name}</h3>
              <p className="text-sm text-muted-foreground">{dept._count.employees} Active Staff</p>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100 flex justify-between items-center">
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Absences</p>
                  <p className="text-lg font-bold text-red-600">{dept.absences}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Late</p>
                  <p className="text-lg font-bold text-amber-600">{dept.lateComings}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Total</p>
                  <p className="text-lg font-bold text-primary">{dept.totalExceptions}</p>
                </div>
              </div>
              <div className="w-12 h-12 rounded-full border-4 border-cyan-100 flex items-center justify-center">
                 <PieChart className="w-5 h-5 text-cyan-500" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
