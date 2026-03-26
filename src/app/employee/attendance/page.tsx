import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default async function EmployeeAttendancePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  
  const employeeId = session.user.employeeId;
  if (!employeeId) {
    return <div className="page-container"><p className="text-muted-foreground">Account not linked to employee profile.</p></div>;
  }

  const results = await prisma.attendanceResult.findMany({
    where: { employeeId },
    include: { shiftTemplate: true },
    orderBy: [{ workDate: "desc" }],
    take: 50,
  });

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Attendance</h1>
          <p className="page-subtitle">Your attendance history and records</p>
        </div>
      </div>
      <div className="table-wrapper">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-gray-50/30">
              <tr>
                <th className="px-5 py-3.5 text-left font-semibold">Date</th>
                <th className="px-5 py-3.5 text-left font-semibold">Shift</th>
                <th className="px-5 py-3.5 text-left font-semibold">In</th>
                <th className="px-5 py-3.5 text-left font-semibold">Out</th>
                <th className="px-5 py-3.5 text-left font-semibold">Worked</th>
                <th className="px-5 py-3.5 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {results.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">No attendance records.</td></tr>
              ) : results.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{format(r.workDate, "MMM dd, yyyy")}</td>
                  <td className="px-5 py-3.5"><span className="badge bg-gray-50 text-gray-700 border-gray-200">{r.shiftTemplate?.name || "—"}</span></td>
                  <td className="px-5 py-3.5 font-mono text-xs">{r.actualIn ? format(r.actualIn, "HH:mm") : <span className="text-red-500">—</span>}</td>
                  <td className="px-5 py-3.5 font-mono text-xs">{r.actualOut ? format(r.actualOut, "HH:mm") : <span className="text-red-500">—</span>}</td>
                  <td className="px-5 py-3.5 text-xs">{r.workedMinutes > 0 ? `${(r.workedMinutes / 60).toFixed(1)}h` : "—"}</td>
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
