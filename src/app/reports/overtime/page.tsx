import prisma from "@/lib/prisma";
import { format, startOfDay } from "date-fns";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Download } from "lucide-react";

export default async function OvertimeReport({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams;
  const startStr = params?.start as string | undefined;
  const endStr = params?.end as string | undefined;
  const deptId = params?.department as string | undefined;
  
  const startDate = startStr ? startOfDay(new Date(startStr)) : startOfDay(new Date());
  const endDate = endStr ? startOfDay(new Date(endStr)) : startDate;
  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
  
  const results = await prisma.attendanceResult.findMany({
    where: {
      workDate: { gte: startDate, lte: endDate },
      overtimeMinutes: { gt: 0 },
      ...(deptId && { employee: { departmentId: deptId } }),
    },
    include: { employee: { include: { department: true } }, shiftTemplate: true },
    orderBy: [{ overtimeMinutes: "desc" }],
  });

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Overtime Report</h1>
          <p className="page-subtitle">Staff overtime hours tracking</p>
        </div>
      </div>
      <div className="table-wrapper">
        <div className="table-toolbar">
          <form className="flex items-center gap-3 flex-wrap">
            <input type="date" name="start" defaultValue={format(startDate, "yyyy-MM-dd")} className="input max-w-[160px]" />
            <span className="text-muted-foreground text-xs">to</span>
            <input type="date" name="end" defaultValue={format(endDate, "yyyy-MM-dd")} className="input max-w-[160px]" />
            <select name="department" defaultValue={deptId || ""} className="input max-w-[180px]">
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button type="submit" className="btn-primary btn-sm">Apply</button>
          </form>
          <button className="btn-secondary btn-sm"><Download className="w-3.5 h-3.5" /> CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-gray-50/30">
              <tr>
                <th className="px-5 py-3.5 text-left font-semibold">Employee</th>
                <th className="px-5 py-3.5 text-left font-semibold">Date</th>
                <th className="px-5 py-3.5 text-left font-semibold">Shift</th>
                <th className="px-5 py-3.5 text-left font-semibold">Worked (hrs)</th>
                <th className="px-5 py-3.5 text-left font-semibold">Overtime (min)</th>
                <th className="px-5 py-3.5 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {results.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">No overtime records found.</td></tr>
              ) : results.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{r.employee.fullName}</td>
                  <td className="px-5 py-3.5 text-gray-600">{format(r.workDate, "MMM dd, yyyy")}</td>
                  <td className="px-5 py-3.5"><span className="badge bg-gray-50 text-gray-700 border-gray-200">{r.shiftTemplate?.name || "—"}</span></td>
                  <td className="px-5 py-3.5 font-mono text-xs">{(r.workedMinutes / 60).toFixed(1)}</td>
                  <td className="px-5 py-3.5"><span className="font-bold text-purple-600">{r.overtimeMinutes}</span></td>
                  <td className="px-5 py-3.5"><StatusBadge status={r.status} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
