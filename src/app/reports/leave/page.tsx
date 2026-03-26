import prisma from "@/lib/prisma";
import { CalendarOff, Filter } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default async function LeaveReport({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; deptId?: string }>;
}) {
  const params = await searchParams;
  const monthStr = params.month || format(new Date(), "yyyy-MM");
  const start = startOfMonth(new Date(monthStr));
  const end = endOfMonth(new Date(monthStr));

  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
  
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      OR: [
        { startDate: { lte: end }, endDate: { gte: start } }
      ],
      ...(params.deptId ? { employee: { departmentId: params.deptId } } : {}),
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
          <h1 className="page-title">Leave & Absence report</h1>
          <p className="page-subtitle">Approved and pending leave requests for {format(start, "MMMM yyyy")}</p>
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

      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Employee</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Type</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Period</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {leaves.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                  No leave records found for this period.
                </td>
              </tr>
            ) : (
              leaves.map(lr => (
                <tr key={lr.id}>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-primary">{lr.employee.fullName}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">{lr.employee.department?.name || "—"}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="badge bg-blue-50 text-blue-700 border-blue-100">{lr.leaveType.name}</span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">
                    {format(lr.startDate, "MMM d")} - {format(lr.endDate, "MMM d, yyyy")}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={lr.status} />
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
