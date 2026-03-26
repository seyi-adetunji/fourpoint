import prisma from "@/lib/prisma";
import { CalendarOff, Filter } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import StatusBadge from "@/components/ui/StatusBadge";

export default async function LeaveReport({
  searchParams,
}: {
  searchParams: { month?: string; deptId?: string };
}) {
  const monthStr = searchParams.month || format(new Date(), "yyyy-MM");
  const start = startOfMonth(new Date(monthStr));
  const end = endOfMonth(new Date(monthStr));

  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
  
  const leaveRequests = await prisma.leaveRequest.findMany({
    where: {
      startDate: { lte: end },
      endDate: { gte: start },
      ...(searchParams.deptId ? { employee: { departmentId: searchParams.deptId } } : {}),
    },
    include: {
      employee: { include: { department: true } },
      leaveType: true,
    },
    orderBy: { startDate: "asc" },
  });

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Leave & Holidays Report</h1>
          <p className="page-subtitle">Staff leave utilization for {format(start, "MMMM yyyy")}</p>
        </div>
      </div>

      <div className="card p-4 mb-6">
        <form className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase">Month</label>
            <input type="month" name="month" defaultValue={monthStr} className="input py-2" />
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

      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Employee</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Type</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Dates</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {leaveRequests.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                  No leave records found for this period.
                </td>
              </tr>
            ) : (
              leaveRequests.map(lr => (
                <tr key={lr.id}>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-primary">{lr.employee.fullName}</p>
                    <p className="text-xs text-muted-foreground">{lr.employee.department.name}</p>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="font-medium text-sky-600">{lr.leaveType.name}</span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {format(lr.startDate, "MMM d")} - {format(lr.endDate, "MMM d, yyyy")}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={lr.status.toLowerCase() as any} label={lr.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
