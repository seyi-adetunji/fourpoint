import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default async function EmployeeCorrectionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  
  const employeeId = session.user.employeeId;
  if (!employeeId) {
    return <div className="page-container"><p className="text-muted-foreground">Account not linked.</p></div>;
  }

  const corrections = await prisma.attendanceCorrection.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Corrections</h1>
          <p className="page-subtitle">Request corrections to your attendance records</p>
        </div>
      </div>
      <div className="table-wrapper">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-gray-50/30">
              <tr>
                <th className="px-5 py-3.5 text-left font-semibold">Date</th>
                <th className="px-5 py-3.5 text-left font-semibold">Reason</th>
                <th className="px-5 py-3.5 text-left font-semibold">Status</th>
                <th className="px-5 py-3.5 text-left font-semibold">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {corrections.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-12 text-center text-muted-foreground">No correction requests.</td></tr>
              ) : corrections.map(c => (
                <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-medium">{format(c.workDate, "MMM dd, yyyy")}</td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground max-w-[300px] truncate">{c.reason}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={c.status} size="sm" /></td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground">{format(c.createdAt, "MMM dd")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
