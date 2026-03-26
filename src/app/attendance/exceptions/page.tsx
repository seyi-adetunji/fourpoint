import prisma from "@/lib/prisma";
import { format, startOfDay } from "date-fns";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Download } from "lucide-react";

export default async function AttendanceExceptionsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams;
  const statusFilter = params?.status as string | undefined;
  const typeFilter = params?.type as string | undefined;

  const exceptions = await prisma.attendanceException.findMany({
    where: {
      ...(statusFilter && { status: statusFilter }),
      ...(typeFilter && { type: typeFilter }),
    },
    include: { employee: { include: { department: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const types = ["NO_SHOW", "MISSING_PUNCH", "LATE_ARRIVAL", "EARLY_EXIT", "SHIFT_CONFLICT", "UNASSIGNED_PUNCH"];
  const statuses = ["PENDING", "RESOLVED", "DISMISSED"];

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Exceptions</h1>
          <p className="page-subtitle">Review and resolve attendance anomalies</p>
        </div>
      </div>
      <div className="table-wrapper">
        <div className="table-toolbar">
          <form className="flex items-center gap-3 flex-wrap">
            <select name="status" defaultValue={statusFilter || ""} className="input max-w-[160px]">
              <option value="">All Statuses</option>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select name="type" defaultValue={typeFilter || ""} className="input max-w-[180px]">
              <option value="">All Types</option>
              {types.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
            <button type="submit" className="btn-primary btn-sm">Filter</button>
          </form>
          <span className="text-xs text-muted-foreground">{exceptions.length} exceptions</span>
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
                  <td className="px-5 py-3.5">
                    <span className="badge-exception">{ex.type.replace(/_/g, " ")}</span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground max-w-[250px] truncate">{ex.details || "—"}</td>
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
