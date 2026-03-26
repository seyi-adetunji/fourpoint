import prisma from "@/lib/prisma";
import { Users, UserX, Clock, AlertCircle, Calendar, Timer, FileText, CalendarOff } from "lucide-react";
import Link from "next/link";
import { startOfDay, subDays, format } from "date-fns";
import { AttendanceChart } from "@/components/AttendanceChart";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Session } from "next-auth";

export async function AdminDashboard({ session }: { session: Session }) {
  const today = startOfDay(new Date());
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
  ] = await Promise.all([
    prisma.employee.count({ where: { isActive: true } }),
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
    { title: "On Duty Today", value: todayPresent, icon: Calendar, color: "text-emerald-600", bgColor: "bg-emerald-50", href: "/attendance/results" },
    { title: "Attendance Rate", value: `${attendanceRate}%`, icon: Clock, color: "text-blue-600", bgColor: "bg-blue-50", href: "/reports/daily" },
    { title: "Absent / No Show", value: absentCount, icon: UserX, color: "text-red-600", bgColor: "bg-red-50", href: "/reports/absence" },
    { title: "Late Today", value: lateCount, icon: Clock, color: "text-amber-600", bgColor: "bg-amber-50", href: "/reports/late" },
    { title: "Exceptions", value: unresolvedExceptions, icon: AlertCircle, color: "text-accent", bgColor: "bg-accent/10", href: "/attendance/exceptions" },
    { title: "Overtime Hours", value: totalOvertimeHours, icon: Timer, color: "text-purple-600", bgColor: "bg-purple-50", href: "/reports/overtime" },
    { title: "Leave Pending", value: pendingLeaves, icon: CalendarOff, color: "text-blue-600", bgColor: "bg-blue-50", href: "/leave" },
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

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href} className="group">
              <div className="metric-card group-hover:shadow-lg group-hover:border-primary/20 transition-all duration-300">
                <div>
                  <p className="metric-label">{card.title}</p>
                  <p className="metric-value mt-1">{card.value}</p>
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
      </div>
    </div>
  );
}
