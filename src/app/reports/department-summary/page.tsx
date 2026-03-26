import prisma from "@/lib/prisma";
import { LayoutGrid, Filter } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

export default async function DepartmentSummaryReport({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const monthStr = params.month || format(new Date(), "yyyy-MM");
  const start = startOfMonth(new Date(monthStr));
  const end = endOfMonth(new Date(monthStr));

  const departments = await prisma.department.findMany({
    include: {
      employees: {
        include: {
          attendanceResults: {
            where: {
              workDate: { gte: start, lte: end },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Department performance Summary</h1>
          <p className="page-subtitle">Operational metrics aggregated by department for {format(start, "MMMM yyyy")}</p>
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

      <div className="grid gap-6 md:grid-cols-2">
        {departments.map(dept => {
          const stats = dept.employees.reduce((acc, emp) => {
            emp.attendanceResults.forEach(r => {
              acc.totalDays += 1;
              acc.totalLate += r.lateMinutes;
              acc.totalEarly += r.earlyExitMinutes;
              acc.totalWork += r.workedMinutes;
              if (r.status === "PRESENT") acc.presentDays += 1;
              if (r.status === "ABSENT" || r.status === "NO_SHOW") acc.absentDays += 1;
            });
            return acc;
          }, { totalDays: 0, presentDays: 0, absentDays: 0, totalLate: 0, totalEarly: 0, totalWork: 0 });

          const attendanceRate = stats.totalDays > 0 ? (stats.presentDays / stats.totalDays * 100).toFixed(1) : "0.0";

          return (
            <div key={dept.id} className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <LayoutGrid className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-lg">{dept.name}</h3>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-primary">{attendanceRate}%</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Attendance Rate</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-gray-50 rounded-xl text-center border border-gray-100">
                  <p className="text-lg font-bold text-emerald-600">{stats.presentDays}</p>
                  <p className="text-[9px] text-gray-500 uppercase font-bold">Present</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl text-center border border-gray-100">
                  <p className="text-lg font-bold text-red-600">{stats.absentDays}</p>
                  <p className="text-[9px] text-gray-500 uppercase font-bold">Absent</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl text-center border border-gray-100">
                  <p className="text-lg font-bold text-amber-600">{stats.totalLate}</p>
                  <p className="text-[9px] text-gray-500 uppercase font-bold">Late (m)</p>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-100 flex items-center justify-between text-xs text-muted-foreground">
                <span>Total Employees: {dept.employees.length}</span>
                <span>Work Hours: {(stats.totalWork / 60).toFixed(1)}h</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
