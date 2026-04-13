import prisma from "@/lib/prisma";
export const dynamic = "force-dynamic";
import { format } from "date-fns";
import { getUTCMidnight } from "@/lib/dateUtils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Download } from "lucide-react";

export default async function DailyAttendanceReport({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams;
  const dateStr = params?.date as string | undefined;
  const deptId = params?.department as string | undefined;
  
  const targetDate = getUTCMidnight(dateStr);
  
  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });

  const results = await prisma.attendanceResult.findMany({
    where: {
      workDate: targetDate,
      ...(deptId && { employee: { departmentId: Number(deptId) } }),
    },
    include: {
      employee: { include: { department: true } },
      shiftTemplate: true,
    },
    orderBy: [{ employee: { fullName: "asc" } }, { sequence: "asc" }],
  });

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Daily Attendance Report</h1>
          <p className="page-subtitle">Department attendance for {format(targetDate, "EEEE, MMMM d, yyyy")}</p>
        </div>
      </div>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <form className="flex items-center gap-3 flex-wrap">
            <input type="date" name="date" defaultValue={format(targetDate, "yyyy-MM-dd")} className="input max-w-[180px]" />
            <select name="department" defaultValue={deptId || ""} className="input max-w-[200px]">
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button type="submit" className="btn-primary btn-sm">Apply</button>
          </form>
          <button className="btn-secondary btn-sm">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-gray-50/30">
              <tr>
                <th className="px-5 py-3.5 text-left font-semibold">Employee</th>
                <th className="px-5 py-3.5 text-left font-semibold">Department</th>
                <th className="px-5 py-3.5 text-left font-semibold">Shift</th>
                <th className="px-5 py-3.5 text-left font-semibold">Actual In</th>
                <th className="px-5 py-3.5 text-left font-semibold">Actual Out</th>
                <th className="px-5 py-3.5 text-left font-semibold">Status</th>
                <th className="px-5 py-3.5 text-left font-semibold">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {results.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">No attendance data for this date.</td></tr>
              ) : (
                results.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-900">{r.employee.fullName}</td>
                    <td className="px-5 py-3.5 text-gray-600">{r.employee.department?.name || "—"}</td>
                    <td className="px-5 py-3.5">
                      <span className="badge bg-gray-50 text-gray-700 border-gray-200">{r.shiftTemplate?.name || "—"}</span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs">
                      {r.actualIn ? format(r.actualIn, "HH:mm") : <span className="text-red-500">—</span>}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs">
                      {r.actualOut ? format(r.actualOut, "HH:mm") : <span className="text-red-500">—</span>}
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={r.status} size="sm" /></td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground max-w-[150px] truncate">
                      {r.remarks || (r.lateMinutes > 0 ? `${r.lateMinutes}m late` : r.earlyExitMinutes > 0 ? `${r.earlyExitMinutes}m early` : "—")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
