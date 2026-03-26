import prisma from "@/lib/prisma";
export const dynamic = "force-dynamic";
import { format } from "date-fns";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Download } from "lucide-react";

export default async function LeavePage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams;
  const statusFilter = params?.status as string | undefined;

  const leaveRequests = await prisma.leaveRequest.findMany({
    where: statusFilter ? { status: statusFilter } : {},
    include: {
      employee: { include: { department: true } },
      leaveType: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Leave Management</h1>
          <p className="page-subtitle">Review and manage leave requests</p>
        </div>
      </div>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <form className="flex items-center gap-3">
            <select name="status" defaultValue={statusFilter || ""} className="input max-w-[180px]">
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <button type="submit" className="btn-primary btn-sm">Filter</button>
          </form>
          <span className="text-xs text-muted-foreground font-medium">{leaveRequests.length} requests</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-gray-50/30">
              <tr>
                <th className="px-5 py-3.5 text-left font-semibold">Employee</th>
                <th className="px-5 py-3.5 text-left font-semibold">Department</th>
                <th className="px-5 py-3.5 text-left font-semibold">Type</th>
                <th className="px-5 py-3.5 text-left font-semibold">Start</th>
                <th className="px-5 py-3.5 text-left font-semibold">End</th>
                <th className="px-5 py-3.5 text-left font-semibold">Reason</th>
                <th className="px-5 py-3.5 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leaveRequests.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">No leave requests found.</td></tr>
              ) : leaveRequests.map(lr => (
                <tr key={lr.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{lr.employee.fullName}</td>
                  <td className="px-5 py-3.5 text-gray-600">{lr.employee.department?.name || "—"}</td>
                  <td className="px-5 py-3.5"><span className="badge-leave">{lr.leaveType.name}</span></td>
                  <td className="px-5 py-3.5 text-gray-600">{format(lr.startDate, "MMM dd, yyyy")}</td>
                  <td className="px-5 py-3.5 text-gray-600">{format(lr.endDate, "MMM dd, yyyy")}</td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground max-w-[200px] truncate">{lr.reason}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={lr.status} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
