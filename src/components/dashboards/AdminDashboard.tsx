import prisma from "@/lib/prisma";
import { Users, UserX, Clock, AlertCircle, Calendar, Timer, FileText, CalendarOff, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { subDays, format } from "date-fns";
import { getUTCMidnight } from "@/lib/dateUtils";
import { AttendanceChart } from "@/components/AttendanceChart";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Session } from "next-auth";
import { PendingShiftActions } from "@/components/dashboards/PendingShiftActions";

export async function AdminDashboard({ session }: { session: Session }) {
  const today = getUTCMidnight();
  const sevenDaysAgo = subDays(today, 6);

  const [
    totalEmployees,
    todayShifts,
    todayPresent,
    unresolvedExceptions,
    recentExceptions,
    rawWeeklyData,
    absentCount,
    lateCount,
    doubleShifts,
    pendingLeaves,
    overtimeResults,
    pendingShiftCount,
    pendingShifts,
    terminalCount,
    livePunchesToday,
    terminals,
  ] = await Promise.all([
    prisma.employee.count(),
    prisma.shiftAssignment.count({ where: { workDate: today } }),
    prisma.attendanceResult.count({
      where: { workDate: today, status: { in: ["PRESENT", "LATE", "EARLY_EXIT"] } }
    }),
    prisma.attendanceException.count({ where: { status: "PENDING" } }),
    prisma.attendanceException.findMany({
      where: { status: "PENDING" },
      take: 5,
      include: { employee: true },
      orderBy: { createdAt: "desc" }
    }),
    prisma.attendanceResult.findMany({
      where: { workDate: { gte: sevenDaysAgo, lte: today } },
      select: { workDate: true, status: true }
    }),
    prisma.attendanceResult.count({
      where: { workDate: today, status: { in: ["ABSENT", "NO_SHOW", "MISSING_PUNCH"] } }
    }),
    prisma.attendanceResult.count({
      where: { workDate: today, status: "LATE" }
    }),
    prisma.shiftAssignment.count({ where: { workDate: today, sequence: 2 } }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.attendanceResult.findMany({
      where: { workDate: today, overtimeMinutes: { gt: 0 } },
      select: { overtimeMinutes: true }
    }),
    prisma.shiftAssignment.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.shiftAssignment.findMany({
      where: { status: "PENDING_APPROVAL" },
      take: 5,
      include: { employee: true, shiftTemplate: true },
      orderBy: { createdAt: "desc" }
    }),
    prisma.iclockTerminal.count(),
    prisma.iclockTransaction.count({ 
      where: { 
        punchTime: { gte: today },
        employee: { isNot: null } // Only count real employee punches
      } 
    }),
    prisma.iclockTerminal.findMany({ orderBy: { lastActivity: "desc" } }),
  ]);

  const totalOvertimeHours = Math.round(overtimeResults.reduce((sum, r) => sum + r.overtimeMinutes, 0) / 60);
  const attendanceRate = todayShifts > 0 ? Math.round((todayPresent / todayShifts) * 100) : 0;

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(today, 6 - i);
    return { date: d, label: format(d, "MMM dd") };
  });

  const chartData = last7Days.map(day => {
    const records = rawWeeklyData.filter(r => Math.abs(r.workDate.getTime() - day.date.getTime()) < 86400000);
    const presentCount = records.filter(r => ["PRESENT", "LATE", "EARLY_EXIT"].includes(r.status)).length;
    const absentCount = records.filter(r => ["ABSENT", "NO_SHOW", "MISSING_PUNCH"].includes(r.status)).length;
    return { date: day.label, present: presentCount, absent: absentCount };
  });

  const cards = [
    { title: "Total Staff", value: totalEmployees, icon: Users, color: "text-secondary", bgColor: "bg-secondary/10", href: "/employees" },
    { title: "On Duty Today", value: todayPresent, icon: Calendar, color: "text-emerald-600", bgColor: "bg-emerald-50", href: "/attendance/results?status=PRESENT" },
    { title: "Live Punches Today", value: livePunchesToday, icon: Timer, color: "text-indigo-600", bgColor: "bg-indigo-50", href: "/attendance/punches" },
    { title: "Connected Clocks", value: terminalCount, icon: Clock, color: "text-emerald-700", bgColor: "bg-emerald-50", href: "#" },
    { title: "Attendance Rate", value: `${attendanceRate}%`, icon: Clock, color: "text-blue-600", bgColor: "bg-blue-50", href: "/reports/daily" },
    { title: "Absent / No Show", value: absentCount, icon: UserX, color: "text-red-600", bgColor: "bg-red-50", href: "/reports/absence" },
    { title: "Late Today", value: lateCount, icon: Clock, color: "text-amber-600", bgColor: "bg-amber-50", href: "/reports/late" },
    { title: "Exceptions", value: unresolvedExceptions, icon: AlertCircle, color: "text-accent", bgColor: "bg-accent/10", href: "/attendance/exceptions" },
  ];

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title text-2xl">Enterprise Overview</h1>
          <p className="page-subtitle">Executive summary of workforce operations across all departments</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium bg-white px-3 py-1.5 rounded-lg border border-border">
            {format(today, "EEEE, MMMM d, yyyy")}
          </span>
        </div>
      </div>

      {/* Primary KPI Section (Big Cards) */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {cards.slice(0, 4).map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href} className="group">
              <div className="big-metric-card animate-slide-up">
                <div className="big-metric-icon-bg bg-white shadow-sm ring-1 ring-border/50">
                  <Icon className={`w-6 h-6 ${card.color}`} />
                </div>
                <div>
                  <p className="big-metric-label">{card.title}</p>
                  <p className="big-metric-value">{card.value}</p>
                </div>
                <div className="flex items-center gap-1.5 mt-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  View Detail <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Secondary KPI Section */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {cards.slice(4).map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href} className="group">
              <div className="metric-card group-hover:shadow-lg transition-all duration-300">
                <div>
                  <p className="metric-label">{card.title}</p>
                  <p className="metric-value mt-1 text-2xl">{card.value}</p>
                </div>
                <div className={`metric-icon ${card.bgColor}`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Weekly Attendance Chart */}
        <Card title="Weekly Attendance" description="7-day attendance trend across all departments" className="lg:col-span-2">
          <AttendanceChart data={chartData} />
        </Card>

        {/* Action Required */}
        <Card title="Action Required" description="Pending exceptions needing resolution" noPadding>
          {recentExceptions.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6 text-emerald-500" />
              </div>
              <p className="text-sm text-muted-foreground">All exceptions resolved</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentExceptions.map((ex) => (
                <Link key={ex.id} href="/attendance/exceptions" className="flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors group">
                  <div>
                    <p className="font-medium text-sm text-primary">{ex.employee.fullName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{format(ex.workDate, "MMM dd")} • {ex.type.replace(/_/g, " ")}</p>
                  </div>
                  <StatusBadge status={ex.status} size="sm" />
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Pending Shift Approvals */}
        <Card title="Shift Approvals" description="Recent shift requests from HODs" noPadding>
          {pendingShifts.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-blue-500" />
              </div>
              <p className="text-sm text-muted-foreground">No pending shift requests</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {pendingShifts.map((sh) => (
                <div key={sh.id} className="p-4 hover:bg-gray-50/50 transition-colors group">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-primary">{sh.employee.fullName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(sh.workDate, "MMM dd")} • {sh.shiftTemplate.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                       <PendingShiftActions assignmentId={sh.id} />
                    </div>
                  </div>
                </div>
              ))}
              {pendingShiftCount > 5 && (
                <Link href="/shifts?status=PENDING_APPROVAL" className="block p-3 text-center text-xs font-semibold text-primary hover:bg-gray-50">
                  View All {pendingShiftCount} Requests
                </Link>
              )}
            </div>
          )}
        </Card>
        {/* Biometric Terminals Status */}
        <Card title="Terminal Status" description="Biometric device connectivity" noPadding>
          <div className="divide-y divide-border">
            {terminals.map((term) => (
              <div key={term.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm text-primary">{term.alias || term.sn}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{term.terminalName} • {term.ipAddress}</p>
                </div>
                <div className="text-right">
                  <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                    term.lastActivity && (new Date().getTime() - new Date(term.lastActivity).getTime() < 3600000)
                      ? "bg-emerald-100 text-emerald-700" 
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {term.lastActivity ? `Active ${format(new Date(term.lastActivity), "HH:mm")}` : "Offline"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
