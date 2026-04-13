import prisma from "@/lib/prisma";
import { format } from "date-fns";
import { getUTCMidnight } from "@/lib/dateUtils";
import { AlertCircle, Filter, Download } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

export default async function ExceptionsReport({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams;
  const startStr = params?.start as string | undefined;
  const endStr = params?.end as string | undefined;
  const deptId = params?.department as string | undefined;
  const typeFilter = params?.type as string | undefined;
  
  const startDate = getUTCMidnight(startStr);
  const endDate = endStr ? getUTCMidnight(endStr) : startDate;
  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
  
  const exceptions = await prisma.attendanceException.findMany({
    where: {
      workDate: { gte: startDate, lte: endDate },
      ...(deptId && { employee: { departmentId: Number(deptId) } }),
      ...(typeFilter && { type: typeFilter }),
    },
    include: { employee: { include: { department: true } } },
    orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
  });

  const exceptionTypes = ["NO_SHOW", "MISSING_PUNCH", "LATE_ARRIVAL", "EARLY_EXIT", "SHIFT_CONFLICT", "UNASSIGNED_PUNCH"];

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Exception Report</h1>
          <p className="page-subtitle">Attendance anomalies and resolution tracking</p>
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
            <select name="type" defaultValue={typeFilter || ""} className="input max-w-[180px]">
              <option value="">All Types</option>
              {exceptionTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
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
                <th className="px-5 py-3.5 text-left font-semibold">Department</th>
                <th className="px-5 py-3.5 text-left font-semibold">Date</th>
                <th className="px-5 py-3.5 text-left font-semibold">Type</th>
                <th className="px-5 py-3.5 text-left font-semibold">Details</th>
                <th className="px-5 py-3.5 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {exceptions.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">No exceptions found.</td></tr>
              ) : exceptions.map(ex => (
                <tr key={ex.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{ex.employee.fullName}</td>
                  <td className="px-5 py-3.5 text-gray-600">{ex.employee.department?.name || "—"}</td>
                  <td className="px-5 py-3.5 text-gray-600">{format(ex.workDate, "MMM dd, yyyy")}</td>
                  <td className="px-5 py-3.5"><StatusBadge status="EXCEPTION" size="sm" /></td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground max-w-[200px] truncate">
                    {ex.type.replace(/_/g, " ")}{ex.details ? `: ${ex.details}` : ""}
                  </td>
                  <td className="px-5 py-3.5"><StatusBadge status={ex.status} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
