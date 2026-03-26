import prisma from "@/lib/prisma";
import { Calendar, Clock, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Session } from "next-auth";
import { startOfDay, format } from "date-fns";

export async function EmployeeDashboard({ session }: { session: Session }) {
  const today = startOfDay(new Date());
  const employeeId = session.user.employeeId;

  if (!employeeId) {
    return (
      <div className="p-8 text-center text-gray-500">
        Your account is not linked to an employee profile. Please contact HR.
      </div>
    );
  }

  const [todayShift, todayAttendance] = await Promise.all([
    prisma.shiftAssignment.findFirst({
      where: { employeeId: employeeId, date: today },
      include: { shiftTemplate: true },
      orderBy: { sequence: "asc" }
    }),
    prisma.attendanceResult.findFirst({
      where: { employeeId: employeeId, date: today }
    })
  ]);

  return (
    <div className="space-y-6 flex flex-col items-stretch max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">My Portal</h1>
        <p className="text-muted-foreground mt-2 text-gray-500">
          Welcome back, {session.user.name}. Here is your schedule for today.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Today's Shift" className="hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-primary">
                {todayShift ? todayShift.shiftTemplate.name : "Off Duty"}
              </div>
              {todayShift && (
                <div className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {todayShift.shiftTemplate.startTime} - {todayShift.shiftTemplate.endTime}
                </div>
              )}
            </div>
            <div className="p-3 rounded-full bg-indigo-100 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </Card>
        
        <Card title="Today's Status" className="hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-primary">
                {todayAttendance ? todayAttendance.status.replace("_", " ") : "Pending Clock In"}
              </div>
            </div>
            <div className="p-3 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </Card>
      </div>
      
      {/* Could add Leave Balances, Announcements, and Recent Punches here later */}
    </div>
  );
}
