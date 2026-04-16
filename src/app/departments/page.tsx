import prisma from "@/lib/prisma";
export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DepartmentsClient } from "./DepartmentsClient";

export default async function DepartmentsPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = ["SUPER_ADMIN", "HR_ADMIN"].includes(session?.user?.role || "");

  const [departments, employees] = await Promise.all([
    prisma.department.findMany({
      include: { 
        _count: { select: { employees: true, users: true } },
        departmentManager: true
      },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, empCode: true },
    })
  ]);

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Departments</h1>
          <p className="page-subtitle">Organizational department management and HOD assignments</p>
        </div>
      </div>

      <DepartmentsClient 
        initialDepartments={departments} 
        employees={employees} 
        isAdmin={isAdmin} 
      />
    </div>
  );
}
