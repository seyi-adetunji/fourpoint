import prisma from "@/lib/prisma";
export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CorrectionsClient } from "./CorrectionsClient";

export default async function AttendanceCorrectionsPage() {
  const session = await getServerSession(authOptions);
  
  const isHOD = session?.user?.role === "HOD" || session?.user?.role === "SUPERVISOR";
  const departmentId = session?.user?.departmentId;

  const [corrections, employees] = await Promise.all([
    prisma.attendanceCorrection.findMany({
      where: {
        ...(isHOD && departmentId && { employee: { departmentId } }),
      },
      include: { employee: { include: { department: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.employee.findMany({
      where: {
        ...(isHOD && departmentId && { departmentId }),
      },
      select: { id: true, fullName: true, empCode: true },
      orderBy: { fullName: "asc" },
    })
  ]);

  return (
    <div className="page-container animate-fade-in">
      <CorrectionsClient initialCorrections={corrections} employees={employees} />
    </div>
  );
}
