import prisma from "@/lib/prisma";
import { Clock, Filter } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

export default async function EarlyExitReport({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; deptId?: string }>;
}) {
  const params = await searchParams;
  const date = params.date ? new Date(params.date) : new Date();
  const start = startOfDay(date);
  const end = endOfDay(date);

  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
  
  const results = await prisma.attendanceResult.findMany({
    where: {
      workDate: { gte: start, lte: end },
      earlyExitMinutes: { gt: 0 },
      ...(params.deptId ? { employee: { departmentId: params.deptId } } : {}),
    },
    include: {
      employee: { include: { department: true } },
    },
    orderBy: { earlyExitMinutes: "desc" },
  });

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Early Exit Report</h1>
          <p className="page-subtitle">Staff who clocked out before shift end on {format(date, "PPP")}</p>
        </div>
      </div>

      <div className="card p-4 mb-6">
        <form className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase">Date</label>
            <input type="date" name="date" defaultValue={params.date || format(new Date(), "yyyy-MM-dd")} className="input py-2" />
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
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Department</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Punch Out</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {results.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                  No early exit records found for this selection.
                </td>
              </tr>
            ) : (
              results.map(r => (
                <tr key={r.id}>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-primary">{r.employee.fullName}</p>
                    <p className="text-xs text-muted-foreground">{r.employee.empCode}</p>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">{r.employee.department?.name || "—"}</td>
                  <td className="px-6 py-4 text-sm font-mono">{r.actualOut ? format(r.actualOut, "HH:mm") : "N/A"}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status="EARLY_EXIT" />
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
