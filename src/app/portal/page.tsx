import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { EmployeeDashboard } from "@/components/dashboards/EmployeeDashboard";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { startOfDay, format, addDays, subDays } from "date-fns";

export default async function PortalPage() {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    redirect("/login");
  }

  const employeeId = session.user.employeeId;

  if (!employeeId) {
    return (
      <div className="p-8 text-center bg-white rounded-lg shadow-sm border border-gray-200 m-8">
        <h2 className="text-xl font-bold text-gray-900">No Employee Profile Linked</h2>
        <p className="text-gray-500 mt-2">Your user account is not associated with an Employee profile. Please contact human resources.</p>
      </div>
    );
  }

  const today = startOfDay(new Date());
  const oneWeekLater = addDays(today, 7);
  const oneWeekAgo = subDays(today, 7);

  const [upcomingShifts, recentAttendance] = await Promise.all([
    prisma.shiftAssignment.findMany({
      where: {
        employeeId: employeeId,
        workDate: { gte: today, lte: oneWeekLater }
      },
      include: { shiftTemplate: true },
      orderBy: [{ workDate: "asc" }, { sequence: "asc" }]
    }),
    prisma.attendanceResult.findMany({
      where: {
        employeeId: employeeId,
        workDate: { gte: oneWeekAgo, lte: today }
      },
      orderBy: { workDate: "desc" }
    })
  ]);

  return (
    <div className="space-y-6">
      <EmployeeDashboard session={session} />
      
      <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
        <Card title="Upcoming Shifts (Next 7 Days)">
          <div className="divide-y divide-border -mx-6 -my-6">
            {upcomingShifts.length === 0 ? (
              <div className="p-6 text-sm text-gray-500 text-center">No shifts scheduled.</div>
            ) : (
              upcomingShifts.map(shift => (
                <div key={shift.id} className="p-4 px-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="font-medium text-primary">{format(shift.workDate, "EEEE, MMM d, yyyy")}</div>
                    <div className="text-sm text-gray-500 mt-0.5">{shift.shiftTemplate.name}</div>
                  </div>
                  <div className="text-sm font-semibold text-gray-900 border rounded py-1 px-3 bg-white">
                    {shift.shiftTemplate.startTime} - {shift.shiftTemplate.endTime}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
        
        <Card title="Recent Attendance">
          <div className="divide-y divide-border -mx-6 -my-6">
            {recentAttendance.length === 0 ? (
              <div className="p-6 text-sm text-gray-500 text-center">No recent records.</div>
            ) : (
              recentAttendance.map(record => (
                <div key={record.id} className="p-4 px-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="font-medium text-primary">{format(record.workDate, "EEE, MMM d")}</div>
                  <StatusBadge status={record.status} />
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
