export const dynamic = "force-dynamic";

import Link from "next/link";
import prisma from "@/lib/prisma";
import { getUTCMidnight, getMonthRangeUTC } from "@/lib/dateUtils";
import { syncAttendanceResultsForRange } from "@/lib/attendanceProcessor";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  ClipboardList,
  Users,
  Clock,
  Timer,
  AlertTriangle,
  CalendarOff,
  Layers,
  Fingerprint,
  UserX,
  BarChart3,
  Building2,
  CalendarRange,
  ShieldAlert,
  TrendingUp,
  ZapOff,
} from "lucide-react";

const reports = [
  {
    title: "Attendance Intelligence",
    description:
      "Live On-Shift/Absent/Off-Shift classification from biometric punches vs rota",
    href: "/reports/daily-attendance",
    icon: ShieldAlert,
    color: "text-red-600",
    bgColor: "bg-red-50",
    badge: "CRITICAL",
  },
  {
    title: "Daily Attendance",
    description: "Department attendance report for any given day",
    href: "/reports/daily",
    icon: ClipboardList,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    title: "Shift Coverage",
    description: "Staff coverage analysis per shift",
    href: "/reports/coverage",
    icon: Users,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
  },
  {
    title: "Late Coming",
    description: "Late arrival tracking with frequency",
    href: "/reports/late",
    icon: Clock,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  {
    title: "Early Exit",
    description: "Staff leaving before shift end",
    href: "/reports/early-exit",
    icon: Clock,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
  {
    title: "Overtime",
    description: "Overtime hours and approval status",
    href: "/reports/overtime",
    icon: Timer,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  {
    title: "Exceptions",
    description: "Attendance anomalies and resolution",
    href: "/reports/exceptions",
    icon: AlertTriangle,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
  },
  {
    title: "Absence & Replacement",
    description: "Absent staff and replacement coverage",
    href: "/reports/absence",
    icon: UserX,
    color: "text-red-600",
    bgColor: "bg-red-50",
  },
  {
    title: "Double Shift",
    description: "Extended and double shift tracking",
    href: "/reports/double-shift",
    icon: Layers,
    color: "text-violet-600",
    bgColor: "bg-violet-50",
  },
  {
    title: "Missing Punch",
    description: "Unresolved missing punch records",
    href: "/reports/missing-punch",
    icon: Fingerprint,
    color: "text-pink-600",
    bgColor: "bg-pink-50",
  },
  {
    title: "Staff Summary",
    description: "Individual attendance summary statistics",
    href: "/reports/summary",
    icon: BarChart3,
    color: "text-teal-600",
    bgColor: "bg-teal-50",
  },
  {
    title: "Department Summary",
    description: "Aggregated department-level metrics",
    href: "/reports/department-summary",
    icon: Building2,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
  },
  {
    title: "Leave & Holidays",
    description: "Leave requests and holiday tracking",
    href: "/reports/leave",
    icon: CalendarOff,
    color: "text-sky-600",
    bgColor: "bg-sky-50",
  },
  {
    title: "Shift Schedule",
    description: "Full shift roster by date range, department and employee",
    href: "/reports/schedule",
    icon: CalendarRange,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
];

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role ?? "EMPLOYEE";
  const userDeptId = (session?.user as any)?.departmentId as
    | number
    | null
    | undefined;
  const isDeptScoped = ["HOD", "DEPT_ADMIN", "SUPERVISOR"].includes(role);
  const empScope =
    isDeptScoped && userDeptId ? { employee: { departmentId: userDeptId } } : {};

  const today = getUTCMidnight();
  const { start: startOfMonth } = getMonthRangeUTC();

  await syncAttendanceResultsForRange(today, today);

  const [
    monthlyStats,
    pendingExceptions,
    todayShifts,
    todayScheduledAttended,
    todayTotalPresent,
  ] = await Promise.all([
    prisma.attendanceResult.aggregate({
      where: {
        workDate: { gte: startOfMonth, lte: today },
        ...empScope,
      },
      _sum: {
        lateMinutes: true,
        earlyExitMinutes: true,
        overtimeMinutes: true,
        workedMinutes: true,
      },
      _count: { id: true },
    }),
    prisma.attendanceException.count({
      where: { status: "PENDING", ...empScope },
    }),
    prisma.shiftAssignment.count({
      where: {
        workDate: today,
        status: { not: "CANCELLED" },
        ...empScope,
      },
    }),
    prisma.attendanceResult.count({
      where: {
        workDate: today,
        shiftAssignmentId: { not: null },
        actualIn: { not: null },
        ...empScope,
      },
    }),
    prisma.attendanceResult.count({
      where: {
        workDate: today,
        actualIn: { not: null },
        ...empScope,
      },
    }),
  ]);

  const attendanceRate =
    todayShifts > 0
      ? Math.min(100, Math.round((todayScheduledAttended / todayShifts) * 100))
      : todayTotalPresent > 0
      ? 100
      : 0;
  const totalLeakage =
    (monthlyStats._sum.lateMinutes || 0) +
    (monthlyStats._sum.earlyExitMinutes || 0);

  const kpiCards = [
    {
      title: "Attendance Health",
      value: `${attendanceRate}%`,
      subtitle:
        todayShifts > 0
          ? `${todayScheduledAttended} / ${todayShifts} Scheduled Today`
          : `${todayTotalPresent} On Duty Today`,
      icon: TrendingUp,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Labor Leakage",
      value: `${Math.round(totalLeakage / 60)}h`,
      subtitle: "Late & Early Exits (MTD)",
      icon: ZapOff,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "Overtime Applied",
      value: `${Math.round((monthlyStats._sum.overtimeMinutes || 0) / 60)}h`,
      subtitle: "Total Recorded OT (MTD)",
      icon: Timer,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
    {
      title: "Action Required",
      value: pendingExceptions,
      subtitle: "Pending Exceptions",
      icon: AlertTriangle,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
  ];

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Enterprise Reports</h1>
          <p className="page-subtitle">
            Historical analytics and compliance tracking
          </p>
        </div>
      </div>

      {/* KPI Section (Big Cards) */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-10">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.title} className="big-metric-card animate-slide-up">
              <div className="big-metric-icon-bg bg-white shadow-sm ring-1 ring-border/50">
                <Icon className={`w-6 h-6 ${kpi.color}`} />
              </div>
              <div>
                <p className="big-metric-label">{kpi.title}</p>
                <p className={`big-metric-value ${kpi.color}`}>{kpi.value}</p>
                <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-widest">
                  {kpi.subtitle}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mb-4">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
          Module Index
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => {
          const Icon = report.icon;
          const isCritical = !!(report as any).badge;
          return (
            <Link key={report.href} href={report.href} className="group">
              <div
                className={`card p-5 group-hover:shadow-lg transition-all duration-300 ${
                  isCritical
                    ? "border-red-200 group-hover:border-red-300 ring-1 ring-red-100"
                    : "group-hover:border-primary/20"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`p-3 rounded-xl ${report.bgColor} flex-shrink-0`}
                  >
                    <Icon className={`w-5 h-5 ${report.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-primary text-sm group-hover:text-primary-dark transition-colors">
                        {report.title}
                      </h3>
                      {isCritical && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-600 border border-red-200 tracking-wider uppercase">
                          {(report as any).badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {report.description}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
