import prisma from "@/lib/prisma";
import { Users, UserX, Clock, AlertCircle, Calendar, Hash } from "lucide-react";
import Link from "next/link";
import { startOfDay, subDays, format } from "date-fns";
import { AttendanceChart } from "@/components/AttendanceChart";
import { Card } from "@/components/ui/Card";
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
    doubleShifts
  ] = await Promise.all([
    prisma.employee.count(),
    prisma.shiftAssignment.count({ where: { date: today } }),
    prisma.attendanceResult.count({
      where: { date: today, status: { in: ["PRESENT", "LATE", "EARLY_EXIT"] } }
    }),
    prisma.attendanceException.count({
      where: { status: "PENDING" }
    }),
    prisma.attendanceException.findMany({
      where: { status: "PENDING" },
      take: 5,
      include: { employee: true },
      orderBy: { createdAt: "desc" }
    }),
    prisma.attendanceResult.findMany({
      where: { date: { gte: sevenDaysAgo, lte: today } },
      select: { date: true, status: true }
    }),
    prisma.attendanceResult.count({
      where: { date: today, status: { in: ["ABSENT", "NO_SHOW", "MISSING_PUNCH"] } }
    }),
    prisma.shiftAssignment.count({
      where: { date: today, sequence: 2 }
    })
  ]);

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(today, 6 - i);
    return { date: d, label: format(d, "MMM dd") };
  });

  const chartData = last7Days.map(day => {
    const records = rawWeeklyData.filter(r => Math.abs(r.date.getTime() - day.date.getTime()) < 1000 * 60 * 60 * 24); 
    const presentCount = records.filter(r => ["PRESENT", "LATE", "EARLY_EXIT"].includes(r.status)).length;
    const absentCount = records.filter(r => ["ABSENT", "NO_SHOW", "MISSING_PUNCH"].includes(r.status)).length;
    
    return { date: day.label, present: presentCount, absent: absentCount };
  });

  const cards = [
    { title: "Total Staff", value: totalEmployees, icon: Users, color: "text-secondary", bgColor: "bg-secondary/10" },
    { title: "On Duty Today", value: todayPresent, icon: Calendar, color: "text-emerald-600", bgColor: "bg-emerald-100" },
    { title: "Absent/No Show", value: absentCount, icon: UserX, color: "text-red-600", bgColor: "bg-red-100" },
    { title: "Late", value: rawWeeklyData.filter(r => r.date.getTime() === today.getTime() && r.status === "LATE").length, icon: Clock, color: "text-yellow-600", bgColor: "bg-yellow-100" },
    { title: "Exceptions", value: unresolvedExceptions, icon: AlertCircle, color: "text-accent", bgColor: "bg-accent/10" },
    { title: "Double Shifts", value: doubleShifts, icon: Hash, color: "text-purple-600", bgColor: "bg-purple-100" },
  ];

  return (
    <div className="space-y-6 flex flex-col items-stretch max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Enterprise Overview</h1>
        <p className="text-muted-foreground mt-2 text-gray-500">
          Executive summary of workforce operations across all departments.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="hover:shadow-md transition-all">
              <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                <h3 className="tracking-tight text-sm font-medium text-gray-500">{card.title}</h3>
                <div className={`p-2 rounded-full ${card.bgColor}`}>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-bold text-primary">{card.value}</div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card title="Weekly Attendance" description="Attendance trends across all departments." className="col-span-1 lg:col-span-2">
          <AttendanceChart data={chartData} />
        </Card>
        
        <Card title="Action Required" description="Recent pending exceptions." className="col-span-1 !p-0">
          <div className="p-0">
            {recentExceptions.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                All exceptions resolved.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentExceptions.map((ex) => (
                  <div key={ex.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="font-medium text-sm text-primary">{ex.employee.name}</p>
                      <p className="text-xs text-gray-500">{ex.type.replace("_", " ")}</p>
                    </div>
                    <Link href={`/exceptions`} className="text-xs font-medium text-accent hover:underline">
                      Resolve
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
