"use client";

import { useState, useMemo } from "react";
import { Building2, Users, Search, Info } from "lucide-react";

interface Department {
  id: number;
  name: string;
  deptCode?: string;
  _count?: {
    employees: number;
  };
}

export default function ManageDepartments({
  initialDepartments,
}: {
  initialDepartments: Department[];
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return initialDepartments;
    return initialDepartments.filter((d) =>
      d.name.toLowerCase().includes(q)
    );
  }, [initialDepartments, search]);

  const totalEmployees = useMemo(
    () =>
      initialDepartments.reduce(
        (acc, d) => acc + (d._count?.employees ?? 0),
        0
      ),
    [initialDepartments]
  );

  return (
    <div className="space-y-4 pt-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-primary">Departments</h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
              {initialDepartments.length} active
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Synchronized with ZKBioTime. Total {totalEmployees} assigned employees.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search departments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-md border border-border/50">
        <Info className="w-4 h-4 text-blue-500 shrink-0" />
        <span>
          Department creation, renaming, and merging are synchronized across ZKBioTime. Use the consolidation panel above if duplicate spellings occur.
        </span>
      </div>

      <div className="overflow-hidden border border-border rounded-lg">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-gray-50/75">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Department Name
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Assigned Employees
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-sm text-gray-500">
                  {search ? "No departments match your search." : "No departments configured."}
                </td>
              </tr>
            ) : (
              filtered.map((dept) => (
                <tr
                  key={dept.id}
                  className="hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <span>{dept.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      <Users className="w-3 h-3 text-gray-500" />
                      {dept._count?.employees ?? 0} employees
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
