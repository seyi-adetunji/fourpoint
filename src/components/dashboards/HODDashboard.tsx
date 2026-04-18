import prisma from "@/lib/prisma";
import { Users, Calendar, AlertCircle, Clock, UserX, Layers } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Session } from "next-auth";
import { format } from "date-fns";
import { getUTCMidnight } from "@/lib/dateUtils";
import Link from "next/link";

export async function HODDashboard({ session }: { session: Session }) {
  const today = getUTCMidnight();
  const departmentId = session.user.departmentId;

  if (!departmentId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-lg font-bold text-primary mb-1">No Department Assigned</h2>
        <p className="text-sm text-muted-foreground">Please contact HR to assign your department.</p>
      </div>
    );
  }

  const department = await prisma.department.findUnique({ 
    where: { id: departmentId },
    include: { departmentManager: true }
  });

  const [
    totalStaff,
    todayShifts,
    todayPresent,
    absentStaff,
    lateStaff,
    doubleShifts,
    exceptions,
    pendingShiftsCount,
  ] = await Promise.all([
    prisma.employee.count({ where: { departmentId } }),
    prisma.shiftAssignment.count({
      where: { workDate: today, employee: { departmentId } }
    }),
    prisma.attendanceResult.count({
      where: { workDate: today, status: { in: ["PRESENT", "LATE", "EARLY_EXIT"] }, employee: { departmentId } }
    }),
    prisma.attendanceResult.count({
      where: { workDate: today, status: { in: ["ABSENT", "NO_SHOW"] }, employee: { departmentId } }
    }),
    prisma.attendanceResult.count({
      where: { workDate: today, status: "LATE", employee: { departmentId } }
    }),
    prisma.shiftAssignment.count({
      where: { workDate: today, sequence: 2, employee: { departmentId } }
    }),
    prisma.attendanceException.findMany({
      where: { status: "PENDING", employee: { departmentId } },
      take: 10,
      include: { employee: true },
      orderBy: { createdAt: "desc" }
    }),
    prisma.shiftAssignment.count({
      where: { status: "PENDING_APPROVAL", employee: { departmentId } }
    }),
  ]);

  const cards = [
    { title: "Department Staff", value: totalStaff, icon: Users, color: "text-secondary", bgColor: "bg-secondary/10", href: "/employees" },
    { title: "On Duty Today", value: todayPresent, icon: Calendar, color: "text-emerald-600", bgColor: "bg-emerald-50", href: "/attendance/results?status=PRESENT" },
    { title: "Absent Staff", value: absentStaff, icon: UserX, color: "text-red-600", bgColor: "bg-red-50", href: "/reports/absence" },
    { title: "Late Staff", value: lateStaff, icon: Clock, color: "text-amber-600", bgColor: "bg-amber-50", href: "/reports/late" },
    { title: "Pending Shifts", value: pendingShiftsCount, icon: Calendar, color: "text-blue-600", bgColor: "bg-blue-50", href: "/shifts?status=PENDING_APPROVAL" },
    { title: "Open Exceptions", value: exceptions.length, icon: AlertCircle, color: "text-accent", bgColor: "bg-accent/10", href: "/attendance/exceptions" },
  ];

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title text-2xl">Department Dashboard</h1>
          <p className="page-subtitle">
            {department?.name || "Department"} • Managed by {department?.departmentManager?.fullName || "Not Assigned"} — {format(today, "EEEE, MMMM d, yyyy")}
          </p>
        </div>
      </div>

      {pendingShiftsCount > 0 && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-800">
                {pendingShiftsCount} shift request{pendingShiftsCount > 1 ? "s" : ""} awaiting HR approval
              </p>
              <p className="text-xs text-blue-600">Your submitted shifts are pending HR review</p>
            </div>
          </div>
          <Link 
            href="/shifts?status=PENDING_APPROVAL" 
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            View Requests
          </Link>
        </div>
      )}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href} className="group">
              <div className="metric-card group-hover:shadow-lg transition-all duration-300">
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

      <Card title="Pending Exceptions" description="Items requiring your attention" noPadding>
        {exceptions.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6 text-emerald-500" />
            </div>
            <p className="text-sm text-muted-foreground">All exceptions resolved for your department</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {exceptions.map((ex) => (
              <Link key={ex.id} href="/attendance/exceptions" className="flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors">
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
  );
}
