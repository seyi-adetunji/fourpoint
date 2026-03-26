import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { format, startOfDay, addDays } from "date-fns";

export default async function EmployeeShiftsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  
  const employeeId = session.user.employeeId;
  if (!employeeId) {
    return <div className="page-container"><p className="text-muted-foreground">Account not linked to employee profile.</p></div>;
  }

  const today = startOfDay(new Date());
  const fourWeeksOut = addDays(today, 28);

  const shifts = await prisma.shiftAssignment.findMany({
    where: { employeeId, workDate: { gte: today, lte: fourWeeksOut } },
    include: { shiftTemplate: true },
    orderBy: [{ workDate: "asc" }, { sequence: "asc" }],
  });

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Shifts</h1>
          <p className="page-subtitle">Your upcoming schedule for the next 4 weeks</p>
        </div>
      </div>
      <div className="table-wrapper">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-gray-50/30">
              <tr>
                <th className="px-5 py-3.5 text-left font-semibold">Date</th>
                <th className="px-5 py-3.5 text-left font-semibold">Day</th>
                <th className="px-5 py-3.5 text-left font-semibold">Shift</th>
                <th className="px-5 py-3.5 text-left font-semibold">Time</th>
                <th className="px-5 py-3.5 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shifts.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">No upcoming shifts.</td></tr>
              ) : shifts.map(s => (
                <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{format(s.workDate, "MMM dd, yyyy")}</td>
                  <td className="px-5 py-3.5 text-gray-600">{format(s.workDate, "EEEE")}</td>
                  <td className="px-5 py-3.5">
                    <span className="badge" style={{ backgroundColor: s.shiftTemplate.color + "15", color: s.shiftTemplate.color, borderColor: s.shiftTemplate.color + "30" }}>
                      {s.shiftTemplate.name}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs">{s.shiftTemplate.startTime} – {s.shiftTemplate.endTime}</td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground">{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
