import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { StatusBadge } from "@/components/ui/StatusBadge";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function EmployeeLeavePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  
  const employeeId = session.user.employeeId;
  if (!employeeId) {
    return <div className="page-container"><p className="text-muted-foreground">Account not linked.</p></div>;
  }

  const [leaveRequests, leaveTypes] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { employeeId },
      include: { leaveType: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.leaveType.findMany(),
  ]);

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Leave Requests</h1>
          <p className="page-subtitle">Submit and track your leave applications</p>
        </div>
      </div>

      <div className="table-wrapper">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-gray-50/30">
              <tr>
                <th className="px-5 py-3.5 text-left font-semibold">Type</th>
                <th className="px-5 py-3.5 text-left font-semibold">Start</th>
                <th className="px-5 py-3.5 text-left font-semibold">End</th>
                <th className="px-5 py-3.5 text-left font-semibold">Reason</th>
                <th className="px-5 py-3.5 text-left font-semibold">Status</th>
                <th className="px-5 py-3.5 text-left font-semibold">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leaveRequests.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">No leave requests submitted.</td></tr>
              ) : leaveRequests.map(lr => (
                <tr key={lr.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-medium">{lr.leaveType.name}</td>
                  <td className="px-5 py-3.5 text-gray-600">{format(lr.startDate, "MMM dd, yyyy")}</td>
                  <td className="px-5 py-3.5 text-gray-600">{format(lr.endDate, "MMM dd, yyyy")}</td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground max-w-[200px] truncate">{lr.reason}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={lr.status} size="sm" /></td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground">{format(lr.createdAt, "MMM dd")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
