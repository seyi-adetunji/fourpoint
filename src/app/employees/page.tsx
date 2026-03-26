import prisma from "@/lib/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import EmployeeSearch from "@/components/EmployeeSearch";

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const resolvedSearchParams = await searchParams;
  const query = resolvedSearchParams?.q as string | undefined;

  let whereClause = {};
  if (query) {
    whereClause = {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { code: { contains: query, mode: "insensitive" } }
      ]
    };
  }

  const employees = await prisma.employee.findMany({
    where: whereClause,
    orderBy: { name: "asc" }
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto flex flex-col items-stretch">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Employees</h1>
          <p className="text-gray-500 mt-2">Manage hotel staff and their departments.</p>
        </div>
        <Link 
          href="/employees/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Employee
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-4 bg-gray-50/50">
          <EmployeeSearch />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 border-b border-border">
              <tr>
                <th scope="col" className="px-6 py-4 font-medium">Code</th>
                <th scope="col" className="px-6 py-4 font-medium">Name</th>
                <th scope="col" className="px-6 py-4 font-medium">Department</th>
                <th scope="col" className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No employees found.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="bg-card hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-primary">
                      {emp.code}
                    </td>
                    <td className="px-6 py-4 text-gray-900">
                      {emp.name}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {emp.department || "Unassigned"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/employees/${emp.id}`}
                        className="font-medium text-accent hover:underline text-xs"
                      >
                        View Details
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
