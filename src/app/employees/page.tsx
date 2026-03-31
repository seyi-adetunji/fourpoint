import prisma from "@/lib/prisma";
export const dynamic = "force-dynamic";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const resolvedSearchParams = await searchParams;
  const query = resolvedSearchParams?.q as string | undefined;
  const deptFilter = resolvedSearchParams?.department as string | undefined;

  const whereClause: any = { isActive: true };
  if (query) {
    whereClause.OR = [
      { fullName: { contains: query, mode: "insensitive" } },
      { empCode: { contains: query, mode: "insensitive" } },
    ];
  }
  if (deptFilter) {
    whereClause.departmentId = deptFilter;
  }

  const [employees, departments] = await Promise.all([
    prisma.employee.findMany({
      where: whereClause,
      include: { department: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">Manage hotel staff and department assignments</p>
        </div>
        <Link href="/employees/new" className="btn-primary">
          <Plus className="w-4 h-4" />
          Add Employee
        </Link>
      </div>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <form className="flex flex-col sm:flex-row items-center gap-3 w-full">
            <div className="relative w-full sm:flex-1 sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                name="q"
                type="text"
                defaultValue={query}
                placeholder="Search..."
                className="input input-with-icon w-full"
              />
            </div>
            <select name="department" defaultValue={deptFilter || ""} className="input w-full sm:max-w-[200px]">
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <button type="submit" className="btn-secondary btn-sm w-full sm:w-auto">Filter</button>
          </form>
          <span className="text-xs text-muted-foreground font-medium hidden sm:block">{employees.length} employees</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-gray-50/30">
              <tr>
                <th className="px-6 py-4 font-semibold">Employee</th>
                <th className="px-6 py-4 font-semibold">Code</th>
                <th className="px-6 py-4 font-semibold">Department</th>
                <th className="px-6 py-4 font-semibold">Designation</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    No employees found.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="bg-card hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {emp.fullName[0]}
                        </div>
                        <span className="font-medium text-gray-900">{emp.fullName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">{emp.empCode}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="badge bg-blue-50 text-blue-700 border-blue-200">
                        {emp.department?.name || "Unassigned"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{emp.designation || "—"}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={emp.isActive ? "PRESENT" : "OFF"} size="sm" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/employees/${emp.id}`} className="text-xs font-semibold text-accent hover:text-accent-light transition-colors">
                        View Details →
                      </Link>
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
