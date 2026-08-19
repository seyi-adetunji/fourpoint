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
    recentShifts,
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
    prisma.shiftAssignment.findMany({
      where: { employee: { departmentId } },
      take: 5,
      include: { employee: true, shiftTemplate: true },
      orderBy: { createdAt: "desc" }
    }),
  ]);

  const cards = [
    { title: "Department Staff", value: totalStaff, icon: Users, color: "text-secondary", bgColor: "bg-secondary/10", href: "/employees" },
    { title: "On Duty Today", value: todayPresent, icon: Calendar, color: "text-emerald-600", bgColor: "bg-emerald-50", href: "/attendance/results?status=PRESENT" },
    { title: "Today's Shifts", value: todayShifts, icon: Calendar, color: "text-blue-600", bgColor: "bg-blue-50", href: "/shifts" },
    { title: "Absent Staff", value: absentStaff, icon: UserX, color: "text-red-600", bgColor: "bg-red-50", href: "/reports/absence" },
    { title: "Late Staff", value: lateStaff, icon: Clock, color: "text-amber-600", bgColor: "bg-amber-50", href: "/reports/late" },
    { title: "Open Exceptions", value: exceptions.length, icon: AlertCircle, color: "text-accent", bgColor: "bg-accent/10", href: "/attendance/exceptions" },
  ];

  return (
    <div className="page-container animate-fade-in space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title text-2xl">Department Dashboard</h1>
          <p className="page-subtitle">
            {department?.name || "Department"} • Managed by {department?.departmentManager?.fullName || "Not Assigned"} — {format(today, "EEEE, MMMM d, yyyy")}
          </p>
        </div>
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Shift Assignments */}
        <Card title="Shift Assignments" description="Recent shift assignments for your department" noPadding>
          {recentShifts.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                <Calendar className="w-6 h-6 text-blue-500" />
              </div>
              <p className="text-sm text-muted-foreground">No shift assignments found for your department</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentShifts.map((sh) => (
                <div key={sh.id} className="p-4 hover:bg-gray-50/50 transition-colors group">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-primary">{sh.employee.fullName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(sh.workDate, "MMM dd, yyyy")} • {sh.shiftTemplate.name} ({sh.shiftTemplate.startTime}–{sh.shiftTemplate.endTime})
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        sh.status === 'SCHEDULED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        sh.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        'bg-gray-100 text-gray-700 border-gray-200'
                      }`}>
                        {sh.status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              <Link href="/shifts" className="block p-3 text-center text-xs font-semibold text-primary hover:bg-gray-50 border-t border-border">
                Manage Department Shifts →
              </Link>
            </div>
          )}
        </Card>

        {/* Pending Exceptions */}
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
    </div>
  );
}
