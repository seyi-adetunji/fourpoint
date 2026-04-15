import prisma from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Building2, Users } from "lucide-react";
export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const departments = await prisma.department.findMany({
    include: { 
      _count: { select: { employees: true, users: true } },
      departmentManager: true
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Departments</h1>
          <p className="page-subtitle">Organizational department management</p>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map(dept => (
          <div key={dept.id} className="card p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl bg-primary/5">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">{dept.deptCode}</span>
            </div>
            <h3 className="font-semibold text-primary text-lg mb-1">{dept.name}</h3>
            
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Head of Department</p>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-[10px] font-bold text-accent">
                  {dept.departmentManager?.fullName?.[0] || "?"}
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {dept.departmentManager?.fullName || "Not Assigned"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>{dept._count.employees} employees</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
