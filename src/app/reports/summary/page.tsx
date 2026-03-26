import prisma from "@/lib/prisma";
import { BarChart3, Filter } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

export default async function SummaryReport({
  searchParams,
}: {
  searchParams: Promise<{ empId?: string; month?: string }>;
}) {
  const params = await searchParams;
  const monthStr = params.month || format(new Date(), "yyyy-MM");
  const start = startOfMonth(new Date(monthStr));
  const end = endOfMonth(new Date(monthStr));

  const employees = await prisma.employee.findMany({ orderBy: { fullName: "asc" } });
  
  // Aggregate statistics for the selected period
  const results = await prisma.attendanceResult.findMany({
    where: {
      workDate: { gte: start, lte: end },
      ...(params.empId ? { employeeId: params.empId } : {}),
    },
    include: {
      employee: { include: { department: true } },
    },
  });

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Summary</h1>
          <p className="page-subtitle">Detailed individual performance metrics for {format(start, "MMMM yyyy")}</p>
        </div>
      </div>

      <div className="card p-4 mb-6">
        <form className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase">Employee</label>
            <select name="empId" className="input py-2" defaultValue={params.empId || ""}>
              <option value="">All Employees</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
            </select>
          </div>
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

      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 font-bold text-gray-500 uppercase text-xs">Employee</th>
              <th className="px-4 py-3 font-bold text-gray-500 uppercase text-xs">Work Days</th>
              <th className="px-4 py-3 font-bold text-gray-500 uppercase text-xs">Late (m)</th>
              <th className="px-4 py-3 font-bold text-gray-500 uppercase text-xs">Early Exit (m)</th>
              <th className="px-4 py-3 font-bold text-gray-500 uppercase text-xs">OT (m)</th>
              <th className="px-4 py-3 font-bold text-gray-500 uppercase text-xs">Work Hrs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {Object.values(results.reduce((acc: any, r) => {
              if (!acc[r.employeeId]) acc[r.employeeId] = { name: r.employee.fullName, dept: r.employee.department?.name || "N/A", days: 0, late: 0, early: 0, ot: 0, work: 0 };
              acc[r.employeeId].days += 1;
              acc[r.employeeId].late += r.lateMinutes;
              acc[r.employeeId].early += r.earlyExitMinutes;
              acc[r.employeeId].ot += r.overtimeMinutes;
              acc[r.employeeId].work += r.workedMinutes;
              return acc;
            }, {})).map((emp: any) => (
              <tr key={emp.name}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-primary">{emp.name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{emp.dept}</p>
                </td>
                <td className="px-4 py-3 font-medium">{emp.days}</td>
                <td className="px-4 py-3 text-amber-600 font-bold">{emp.late}</td>
                <td className="px-4 py-3 text-orange-600 font-bold">{emp.early}</td>
                <td className="px-4 py-3 text-blue-600 font-bold">{emp.ot}</td>
                <td className="px-4 py-3 font-mono">{(emp.work / 60).toFixed(1)}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
