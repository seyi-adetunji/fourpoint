import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Briefcase, Calendar, Clock, AlertCircle, Building2, User } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/Card";

export default async function EmployeeDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      department: true,
      shiftAssignments: {
        include: { shiftTemplate: true },
        orderBy: { workDate: "desc" },
        take: 10
      },
      attendanceResults: {
        include: { shiftTemplate: true },
        orderBy: { workDate: "desc" },
        take: 10
      },
      exceptions: {
        where: { status: "PENDING" },
        orderBy: { workDate: "desc" }
      }
    }
  });

  if (!employee) notFound();

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/employees" className="p-2 bg-white rounded-xl border border-border hover:bg-gray-50 transition-colors shadow-sm text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="page-title flex items-center gap-3">
            {employee.fullName}
            {employee.exceptions.length > 0 && (
              <span className="badge-exception">
                <AlertCircle className="w-3.5 h-3.5" />
                {employee.exceptions.length} Issues
              </span>
            )}
          </h1>
          <p className="page-subtitle flex items-center gap-2 mt-1">
            <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-sm text-gray-700">{employee.empCode}</span>
            • {employee.department?.name || "Unassigned"} • {employee.designation || "Staff"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Info & Shifts */}
        <div className="space-y-6">
          <Card title="Employee Profile">
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-border">
                <User className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Full Name</p>
                  <p className="text-sm font-medium text-gray-900">{employee.fullName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-border">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Department</p>
                  <p className="text-sm font-medium text-gray-900">{employee.department?.name || "Unassigned"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-border">
                <Briefcase className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Designation</p>
                  <p className="text-sm font-medium text-gray-900">{employee.designation || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-border">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Registered</p>
                  <p className="text-sm font-medium text-gray-900">{format(employee.createdAt, "MMMM d, yyyy")}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Recent Shifts" noPadding>
            <div className="divide-y divide-border">
              {employee.shiftAssignments.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No recent shifts.</div>
              ) : (
                employee.shiftAssignments.map(a => (
                  <div key={a.id} className="p-4 flex justify-between items-center hover:bg-gray-50/50 transition-colors">
                    <div>
                      <span className="font-medium text-sm text-gray-900">{format(a.workDate, "MMM dd, yyyy")}</span>
                      <span className="block text-xs text-muted-foreground">{a.shiftTemplate.startTime} – {a.shiftTemplate.endTime}</span>
                    </div>
                    <span className="badge" style={{ backgroundColor: (a.shiftTemplate.color || "#6b7280") + "15", color: a.shiftTemplate.color || "#6b7280", borderColor: (a.shiftTemplate.color || "#6b7280") + "30" }}>
                      {a.shiftTemplate.name}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Attendance & Exceptions */}
        <div className="lg:col-span-2 space-y-6">
          {employee.exceptions.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-red-200 bg-red-100/50 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <h3 className="text-sm font-semibold text-red-900">Unresolved Exceptions</h3>
              </div>
              <div className="divide-y divide-red-100">
                {employee.exceptions.map(ex => (
                  <Link key={ex.id} href="/attendance/exceptions" className="flex items-center justify-between p-4 hover:bg-red-50/80 transition-colors">
                    <div>
                      <p className="font-medium text-sm text-red-900">{format(ex.workDate, "MMM dd, yyyy")} — {ex.type.replace(/_/g, " ")}</p>
                      <p className="text-xs text-red-700 mt-0.5">{ex.details || "System flagged anomaly"}</p>
                    </div>
                    <StatusBadge status={ex.status} size="sm" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          <Card title="Attendance History" noPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-gray-50/30">
                  <tr>
                    <th className="px-5 py-3.5 text-left font-semibold">Date</th>
                    <th className="px-5 py-3.5 text-left font-semibold">Shift</th>
                    <th className="px-5 py-3.5 text-left font-semibold">In / Out</th>
                    <th className="px-5 py-3.5 text-left font-semibold">Worked</th>
                    <th className="px-5 py-3.5 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {employee.attendanceResults.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">No attendance records.</td></tr>
                  ) : (
                    employee.attendanceResults.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-gray-900">{format(r.workDate, "MMM dd, yyyy")}</td>
                        <td className="px-5 py-3.5">
                          <span className="badge bg-gray-50 text-gray-700 border-gray-200">{r.shiftTemplate?.name || "—"}</span>
                        </td>
                        <td className="px-5 py-3.5 text-xs font-mono">
                          <span>{r.actualIn ? format(r.actualIn, "HH:mm") : <span className="text-red-500">—</span>}</span>
                          <span className="text-gray-400 mx-1">/</span>
                          <span>{r.actualOut ? format(r.actualOut, "HH:mm") : <span className="text-red-500">—</span>}</span>
                        </td>
                        <td className="px-5 py-3.5 text-xs">{r.workedMinutes > 0 ? `${(r.workedMinutes / 60).toFixed(1)}h` : "—"}</td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={r.status} size="sm" />
                          {r.lateMinutes > 0 && <span className="block text-[10px] text-amber-600 mt-0.5">{r.lateMinutes}m late</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
