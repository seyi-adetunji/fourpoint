import prisma from "@/lib/prisma";
import { Users, Calendar, AlertCircle, Clock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Session } from "next-auth";
import { startOfDay } from "date-fns";
import Link from "next/link";

export async function HODDashboard({ session }: { session: Session }) {
  const today = startOfDay(new Date());
  
  const departmentId = session.user.departmentId;

  if (!departmentId) {
    return (
      <div className="p-8 text-center text-gray-500">
        You are not assigned to any department. Please contact HR.
      </div>
    );
  }

  const [
    totalEmployees,
    todayShifts,
    exceptions
  ] = await Promise.all([
    prisma.employee.count({ where: { department: departmentId } }),
    prisma.shiftAssignment.count({
      where: { 
        date: today,
        employee: { department: departmentId } 
      }
    }),
    prisma.attendanceException.findMany({
      where: { 
        status: "PENDING",
        employee: { department: departmentId }
      },
      take: 10,
      include: { employee: true },
      orderBy: { createdAt: "desc" }
    }),
  ]);

  return (
    <div className="space-y-6 flex flex-col items-stretch max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Department Dashboard</h1>
        <p className="text-muted-foreground mt-2 text-gray-500">
          Overview of your department's attendance and active alerts.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card title="Department Staff" className="hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold text-primary">{totalEmployees}</div>
            <div className="p-2 rounded-full bg-blue-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </Card>
        <Card title="Today's Shifts" className="hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold text-primary">{todayShifts}</div>
            <div className="p-2 rounded-full bg-indigo-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
        </Card>
        <Card title="Pending Exceptions" className="hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold text-primary">{exceptions.length}</div>
            <div className="p-2 rounded-full bg-accent/10 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-accent" />
            </div>
          </div>
        </Card>
      </div>

      <Card title="Department Exceptions Action Required" className="!p-0">
        <div className="p-0">
          {exceptions.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              All exceptions resolved for your department.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {exceptions.map((ex) => (
                <div key={ex.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="font-medium text-sm text-primary">{ex.employee.name}</p>
                    <p className="text-xs text-gray-500">{ex.type.replace("_", " ")}</p>
                  </div>
                  <Link href={`/exceptions`} className="text-xs font-medium text-accent hover:underline">
                    Review
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
