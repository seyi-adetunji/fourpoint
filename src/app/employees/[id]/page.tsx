import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Briefcase, Calendar, Clock, AlertCircle } from "lucide-react";
import Link from "next/link";
import EditEmployeeModal from "@/components/EditEmployeeModal";

export default async function EmployeeDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      shiftAssignments: {
        include: { shiftTemplate: true },
        orderBy: { date: "desc" },
        take: 10
      },
      attendanceResults: {
        include: { shiftAssignment: { include: { shiftTemplate: true } } },
        orderBy: { date: "desc" },
        take: 10
      },
      exceptions: {
        where: { status: "PENDING" },
        orderBy: { date: "desc" }
      }
    }
  });

  if (!employee) {
    notFound();
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PRESENT":
        return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800">Present</span>;
      case "LATE":
        return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-amber-100 text-amber-800">Late</span>;
      case "EARLY_EXIT":
        return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-amber-100 text-amber-800">Early Exit</span>;
      case "ABSENT":
      case "NO_SHOW":
        return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-red-100 text-red-800">{status.replace("_", " ")}</span>;
      case "MISSING_PUNCH":
        return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-orange-100 text-orange-800">Missing Punch</span>;
      default:
        return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto flex flex-col items-stretch">
      <div className="flex items-center gap-4">
        <Link href="/employees" className="p-2 bg-white rounded-full border border-border hover:bg-gray-50 transition-colors shadow-sm text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
            {employee.name}
            {employee.exceptions.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                <AlertCircle className="w-3.5 h-3.5" />
                {employee.exceptions.length} Issues
              </span>
            )}
          </h1>
          <p className="text-gray-500 mt-1 flex items-center gap-2">
            <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-sm text-gray-700">{employee.code}</span>
            • Joined {format(employee.createdAt, "MMMM yyyy")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Info & Shifts */}
        <div className="md:col-span-1 space-y-6">
          <div className="rounded-xl border border-border bg-card shadow-sm p-6">
            <h3 className="text-lg font-semibold tracking-tight text-primary mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-gray-400" />
              Employee Profile
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Department</p>
                <p className="font-medium text-gray-900">{employee.department || "Unassigned"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Internal ID</p>
                <p className="font-medium text-gray-900">{employee.id}</p>
              </div>
            </div>
            <EditEmployeeModal employee={employee} />
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm p-0 overflow-hidden">
            <div className="p-4 border-b border-border bg-gray-50/50">
              <h3 className="text-sm font-semibold tracking-tight text-primary flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                Recent Shift Assignments
              </h3>
            </div>
            <div className="divide-y divide-border">
              {employee.shiftAssignments.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-500">No recent shifts.</div>
              ) : (
                employee.shiftAssignments.map((assignment) => (
                  <div key={assignment.id} className="p-4 flex flex-col gap-1 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm text-gray-900">{format(assignment.date, "MMM dd, yyyy")}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-800">
                        {assignment.shiftTemplate.name}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {assignment.shiftTemplate.startTime} - {assignment.shiftTemplate.endTime}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Attendance History */}
        <div className="md:col-span-2 space-y-6">
          
          {employee.exceptions.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 shadow-sm p-0 overflow-hidden">
              <div className="p-4 border-b border-red-200 bg-red-100/50 flex justify-between items-center">
                <h3 className="text-sm font-semibold tracking-tight text-red-900 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  Action Required: Unresolved Exceptions
                </h3>
              </div>
              <div className="divide-y divide-red-100">
                {employee.exceptions.map((ex) => (
                  <div key={ex.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-red-900">{format(ex.date, "MMM dd, yyyy")} - {ex.type.replace("_", " ")}</p>
                      <p className="text-xs text-red-700 mt-1">{ex.reason || "System flagged anomaly"}</p>
                    </div>
                    <Link href={`/exceptions`} className="text-xs font-medium px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">
                      Resolve
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card shadow-sm p-0 overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between bg-gray-50/50">
              <h3 className="text-sm font-semibold tracking-tight text-primary flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                Attendance History
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 font-medium">Shift</th>
                    <th className="px-6 py-4 font-medium">In / Out</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {employee.attendanceResults.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                        No attendance records found.
                      </td>
                    </tr>
                  ) : (
                    employee.attendanceResults.map((res) => (
                      <tr key={res.id} className="bg-card hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                          {format(res.date, "MMM dd, yyyy")}
                        </td>
                        <td className="px-6 py-4 text-gray-700 whitespace-nowrap">
                          <div className="font-medium text-xs">{res.shiftAssignment.shiftTemplate.name}</div>
                        </td>
                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap min-w-[120px]">
                          <div className="text-xs flex gap-4">
                            <span><span className="text-gray-400">IN:</span> {res.punchIn ? format(res.punchIn, "HH:mm") : <span className="text-red-500">--:--</span>}</span>
                            <span><span className="text-gray-400">OUT:</span> {res.punchOut ? format(res.punchOut, "HH:mm") : <span className="text-red-500">--:--</span>}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1 items-start">
                            {getStatusBadge(res.status)}
                            {(res.minutesLate > 0 || res.minutesEarly > 0) && (
                              <span className="text-[10px] text-amber-600 font-medium">
                                {res.minutesLate > 0 ? `+${res.minutesLate}m Late` : ''} {res.minutesEarly > 0 ? `-${res.minutesEarly}m Early` : ''}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
