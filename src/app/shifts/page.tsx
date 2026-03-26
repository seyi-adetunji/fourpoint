import prisma from "@/lib/prisma";
import { format, startOfDay } from "date-fns";
import { Filter } from "lucide-react";
import AssignShiftModal from "@/components/AssignShiftModal";
import EditShiftModal from "@/components/EditShiftModal";
import ShiftFilter from "@/components/ShiftFilter";

export default async function ShiftsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  // Await searchParams before accessing properties (Next.js 15 recommendation)
  const resolvedSearchParams = await searchParams;
  
  const selectedDate = resolvedSearchParams?.date ? startOfDay(new Date(resolvedSearchParams.date as string)) : startOfDay(new Date());
  const selectedEmployeeId = resolvedSearchParams?.employee as string | undefined;

  const [shiftAssignments, employees] = await Promise.all([
    prisma.shiftAssignment.findMany({
      where: {
        ...(resolvedSearchParams?.date ? { date: selectedDate } : { date: { gte: selectedDate } }),
        ...(selectedEmployeeId && { employeeId: selectedEmployeeId })
      },
      include: {
        employee: true,
        shiftTemplate: true,
      },
      orderBy: [
        { date: "asc" },
        { sequence: "asc" },
        { employee: { name: "asc" } },
      ],
      take: 100,
    }),
    prisma.employee.findMany({
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, department: true },
    }),
  ]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto flex flex-col items-stretch">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            Shift Assignments
          </h1>
          <p className="text-gray-500 mt-2">
            Manage upcoming employee schedules and rotas.
          </p>
        </div>
        <div className="flex gap-2">
          <ShiftFilter employees={employees} />
          {/* Interactive Assign Shift Modal */}
          <AssignShiftModal employees={employees} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 border-b border-border">
              <tr>
                <th scope="col" className="px-6 py-4 font-medium">
                  Date
                </th>
                <th scope="col" className="px-6 py-4 font-medium">
                  Employee
                </th>
                <th scope="col" className="px-6 py-4 font-medium">
                  Shift Type
                </th>
                <th scope="col" className="px-6 py-4 font-medium">
                  Timing
                </th>
                <th scope="col" className="px-6 py-4 font-medium text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shiftAssignments.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    No upcoming shifts found. Click &ldquo;Assign Shift&rdquo; to get started.
                  </td>
                </tr>
              ) : (
                shiftAssignments.map((assignment) => (
                  <tr
                    key={assignment.id}
                    className="bg-card hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {format(assignment.date, "MMM dd, yyyy")}
                    </td>
                    <td className="px-6 py-4 text-primary font-medium">
                      {assignment.employee.name}
                      <span className="block text-xs text-gray-500 font-normal">
                        {assignment.employee.code}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-800">
                        {assignment.shiftTemplate.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {assignment.shiftTemplate.startTime} –{" "}
                      {assignment.shiftTemplate.endTime}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <EditShiftModal assignment={assignment} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
