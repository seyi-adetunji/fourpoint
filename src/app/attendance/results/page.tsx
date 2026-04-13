import prisma from "@/lib/prisma";
export const dynamic = "force-dynamic";
import { format } from "date-fns";
import { getUTCMidnight } from "@/lib/dateUtils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Download, Search } from "lucide-react";

export default async function AttendanceResultsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams;
  const dateStr = params?.date as string | undefined;
  const deptId = params?.department as string | undefined;
  const statusFilter = params?.status as string | undefined;

  const targetDate = getUTCMidnight(dateStr);
  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });

  const results = await prisma.attendanceResult.findMany({
    where: {
      workDate: targetDate,
      ...(deptId && { employee: { departmentId: Number(deptId) } }),
      ...(statusFilter && { status: statusFilter }),
    },
    include: {
      employee: { include: { department: true } },
      shiftTemplate: true,
    },
    orderBy: [{ employee: { fullName: "asc" } }, { sequence: "asc" }],
  });

  const statuses = ["PRESENT", "LATE", "EARLY_EXIT", "LATE_AND_EARLY", "ABSENT", "NO_SHOW", "MISSING_PUNCH"];

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Results</h1>
          <p className="page-subtitle">Processed attendance records for {format(targetDate, "MMMM d, yyyy")}</p>
        </div>
      </div>
      <div className="table-wrapper">
        <div className="table-toolbar">
          <form className="flex items-center gap-3 flex-wrap">
            <input type="date" name="date" defaultValue={format(targetDate, "yyyy-MM-dd")} className="input max-w-[180px]" />
            <select name="department" defaultValue={deptId || ""} className="input max-w-[180px]">
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select name="status" defaultValue={statusFilter || ""} className="input max-w-[180px]">
              <option value="">All Statuses</option>
              {statuses.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
            <button type="submit" className="btn-primary btn-sm">Filter</button>
          </form>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{results.length} records</span>
            <button className="btn-secondary btn-sm"><Download className="w-3.5 h-3.5" /> CSV</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-gray-50/30">
              <tr>
                <th className="px-5 py-3.5 text-left font-semibold">Employee</th>
                <th className="px-5 py-3.5 text-left font-semibold">Department</th>
                <th className="px-5 py-3.5 text-left font-semibold">Shift</th>
                <th className="px-5 py-3.5 text-left font-semibold">In</th>
                <th className="px-5 py-3.5 text-left font-semibold">Out</th>
                <th className="px-5 py-3.5 text-left font-semibold">Worked</th>
                <th className="px-5 py-3.5 text-left font-semibold">OT</th>
                <th className="px-5 py-3.5 text-left font-semibold">Status</th>
                <th className="px-5 py-3.5 text-left font-semibold">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {results.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-muted-foreground">No results for this date.</td></tr>
              ) : results.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{r.employee.fullName}</td>
                  <td className="px-5 py-3.5 text-gray-600">{r.employee.department?.name || "—"}</td>
                  <td className="px-5 py-3.5">
                    <span className="badge" style={{ backgroundColor: (r.shiftTemplate?.color || "#6b7280") + "15", color: r.shiftTemplate?.color || "#6b7280", borderColor: (r.shiftTemplate?.color || "#6b7280") + "30" }}>
                      {r.shiftTemplate?.name || "—"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs">{r.actualIn ? format(r.actualIn, "HH:mm") : <span className="text-red-500">—</span>}</td>
                  <td className="px-5 py-3.5 font-mono text-xs">{r.actualOut ? format(r.actualOut, "HH:mm") : <span className="text-red-500">—</span>}</td>
                  <td className="px-5 py-3.5 text-xs">{r.workedMinutes > 0 ? `${(r.workedMinutes / 60).toFixed(1)}h` : "—"}</td>
                  <td className="px-5 py-3.5 text-xs">{r.overtimeMinutes > 0 ? <span className="font-bold text-purple-600">{r.overtimeMinutes}m</span> : "—"}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={r.status} size="sm" /></td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground max-w-[150px] truncate">{r.remarks || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
