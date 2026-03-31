import prisma from "@/lib/prisma";
import { Calendar, Clock, CheckCircle2, CalendarOff, FileEdit, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Session } from "next-auth";
import { startOfDay, addDays, format } from "date-fns";
import Link from "next/link";

export async function EmployeeDashboard({ session }: { session: Session }) {
  const today = startOfDay(new Date());
  const weekEnd = addDays(today, 6);
  const employeeId = session.user.employeeId;

  if (!employeeId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-lg font-bold text-primary mb-1">Account Not Linked</h2>
        <p className="text-sm text-muted-foreground">Your account is not linked to an employee profile. Please contact HR.</p>
      </div>
    );
  }

  const [employee, todayShifts, todayAttendance, weeklyRota, pendingLeaves, pendingCorrections] = await Promise.all([
    prisma.employee.findUnique({ where: { id: employeeId }, include: { department: true } }),
    prisma.shiftAssignment.findMany({
      where: { employeeId, workDate: today },
      include: { shiftTemplate: true },
      orderBy: { sequence: "asc" }
    }),
    prisma.attendanceResult.findMany({
      where: { employeeId, workDate: today },
      orderBy: { sequence: "asc" }
    }),
    prisma.shiftAssignment.findMany({
      where: { employeeId, workDate: { gte: today, lte: weekEnd } },
      include: { shiftTemplate: true },
      orderBy: [{ workDate: "asc" }, { sequence: "asc" }]
    }),
    prisma.leaveRequest.count({ where: { employeeId, status: "PENDING" } }),
    prisma.attendanceCorrection.count({ where: { employeeId, status: "PENDING" } }),
  ]);

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title text-2xl">Welcome back, {employee?.fullName?.split(" ")[0] || session.user.name}</h1>
          <p className="page-subtitle">
            {employee?.department?.name || "Staff"} • {format(today, "EEEE, MMMM d, yyyy")}
          </p>
        </div>
      </div>

      {/* Today's Shift & Status */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="!p-0">
          <div className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today&apos;s Shift</p>
              <div className="p-2 rounded-xl bg-blue-50">
                <Calendar className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <p className="text-lg sm:text-xl font-bold text-primary">
              {todayShifts.length > 0 ? todayShifts.map(s => s.shiftTemplate.name).join(" + ") : "Off Duty"}
            </p>
            {todayShifts.length > 0 && (
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                {todayShifts.map(s => `${s.shiftTemplate.startTime} – ${s.shiftTemplate.endTime}`).join(" | ")}
              </p>
            )}
          </div>
        </Card>

        <Card className="!p-0">
          <div className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</p>
              <div className="p-2 rounded-xl bg-emerald-50">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <p className="text-lg sm:text-xl font-bold text-primary">
              {todayAttendance.length > 0 
                ? todayAttendance[0].status.replace(/_/g, " ")
                : todayShifts.length > 0 ? "Awaiting Clock In" : "Day Off"
              }
            </p>
            {todayAttendance.length > 0 && todayAttendance[0].actualIn && (
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                Clocked in at {format(todayAttendance[0].actualIn, "HH:mm")}
              </p>
            )}
          </div>
        </Card>

        <Link href="/employee/leave" className="group">
          <Card className="!p-0 group-hover:border-primary/20 transition-all">
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Leave Requests</p>
                <div className="p-2 rounded-xl bg-blue-50">
                  <CalendarOff className="w-4 h-4 text-blue-600" />
                </div>
              </div>
              <p className="text-lg sm:text-xl font-bold text-primary">{pendingLeaves}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Pending requests</p>
            </div>
          </Card>
        </Link>

        <Link href="/employee/corrections" className="group">
          <Card className="!p-0 group-hover:border-primary/20 transition-all">
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Corrections</p>
                <div className="p-2 rounded-xl bg-amber-50">
                  <FileEdit className="w-4 h-4 text-amber-600" />
                </div>
              </div>
              <p className="text-lg sm:text-xl font-bold text-primary">{pendingCorrections}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Pending corrections</p>
            </div>
          </Card>
        </Link>
      </div>

      {/* Weekly Rota Preview */}
      <Card title="This Week's Schedule" description="Your upcoming shift assignments">
        {weeklyRota.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No shifts scheduled this week.</p>
        ) : (
          <div className="relative">
            <div className="flex sm:grid sm:grid-cols-7 gap-2 overflow-x-auto pb-2 scrollbar-none">
              {Array.from({ length: 7 }, (_, i) => {
                const day = addDays(today, i);
                const dayShifts = weeklyRota.filter(s => 
                  Math.abs(s.workDate.getTime() - day.getTime()) < 86400000
                );
                const isToday = i === 0;

                return (
                  <div
                    key={i}
                    className={`flex-shrink-0 w-24 sm:w-auto rounded-xl border p-2 sm:p-3 text-center transition-all
                      ${isToday ? "border-primary/30 bg-primary/5 ring-1 ring-primary/10" : "border-border"}`}
                  >
                    <p className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                      {format(day, "EEE")}
                    </p>
                    <p className={`text-base sm:text-sm font-bold mt-0.5 ${isToday ? "text-primary" : "text-gray-800"}`}>
                      {format(day, "d")}
                    </p>
                    <div className="mt-2 space-y-1">
                      {dayShifts.length === 0 ? (
                        <span className="text-[9px] sm:text-[10px] text-gray-400 font-medium">OFF</span>
                      ) : (
                        dayShifts.map(s => (
                          <div
                            key={s.id}
                            className="text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded-md truncate"
                            style={{ 
                              backgroundColor: s.shiftTemplate.color + "15",
                              color: s.shiftTemplate.color
                            }}
                            title={s.shiftTemplate.name}
                          >
                            {s.shiftTemplate.code}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
