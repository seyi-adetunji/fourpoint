import prisma from "@/lib/prisma";
import { format } from "date-fns";
import { AlertTriangle, Search } from "lucide-react";
import { ResolveExceptionButton } from "@/components/ResolveExceptionButton";
import ExceptionFilter from "@/components/ExceptionFilter";

export default async function ExceptionsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const resolvedSearchParams = await searchParams;
  const statusFilter = (resolvedSearchParams?.status as string) || "unresolved";

  let whereClause = {};
  if (statusFilter === "unresolved") {
    whereClause = { status: "PENDING" };
  } else if (statusFilter === "resolved") {
    whereClause = { status: { not: "PENDING" } };
  }

  const exceptions = await prisma.attendanceException.findMany({
    where: whereClause,
    include: {
      employee: true,
      attendanceResult: {
        include: {
          shiftAssignment: {
            include: {
              shiftTemplate: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto flex flex-col items-stretch">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Exceptions Review</h1>
          <p className="text-gray-500 mt-2">Manage unresolved attendance issues (missing punches, late arrivals, absences).</p>
        </div>
        <div className="flex gap-2">
          <ExceptionFilter />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between bg-gray-50/50">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search exceptions..." 
              className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 border-b border-border">
              <tr>
                <th scope="col" className="px-6 py-4 font-medium">Date Raised</th>
                <th scope="col" className="px-6 py-4 font-medium">Employee</th>
                <th scope="col" className="px-6 py-4 font-medium">Exception Type</th>
                <th scope="col" className="px-6 py-4 font-medium">System Note</th>
                <th scope="col" className="px-6 py-4 font-medium">Status</th>
                <th scope="col" className="px-6 py-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {exceptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-500">
                      <AlertTriangle className="w-8 h-8 text-emerald-500 md:text-emerald-400" />
                      <p>All clear. No unresolved exceptions found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                exceptions.map((ex) => (
                  <tr key={ex.id} className="bg-card hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                      {format(ex.date, "MMM dd, yyyy")}
                    </td>
                    <td className="px-6 py-4 text-primary font-medium">
                      {ex.employee.name}
                      <span className="block text-xs text-gray-500 font-normal">{ex.employee.code}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-accent/10 text-accent">
                        {ex.type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 max-w-xs truncate">
                        {ex.reason || "System flagged anomaly"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${ex.status === "PENDING" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                        {ex.status === "PENDING" ? "Requires Action" : ex.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {ex.status === "PENDING" ? <ResolveExceptionButton exceptionId={ex.id} /> : <span className="text-xs text-gray-500">Done</span>}
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
