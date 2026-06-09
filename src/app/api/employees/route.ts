/**
 * GET  /api/employees  → list employees (read from workforce schema)
 * POST /api/employees  → 405 (employees are managed in ZKBio)
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || undefined;
    let departmentIdParam = searchParams.get("department") ? parseInt(searchParams.get("department") as string) : undefined;

    const userRole = (session.user as any).role ?? "EMPLOYEE";
    const userDeptId = (session.user as any).departmentId as number | null;
    const isDeptScoped = ["HOD", "DEPT_ADMIN", "SUPERVISOR"].includes(userRole);

    if (isDeptScoped && userDeptId) {
      departmentIdParam = userDeptId;
    }

    const whereClause: any = {};
    if (q) {
      whereClause.OR = [
        { fullName: { contains: q, mode: "insensitive" } },
        { empCode: { contains: q, mode: "insensitive" } },
      ];
    }
    if (departmentIdParam) {
      whereClause.departmentId = departmentIdParam;
    }

    const employees = await prisma.employee.findMany({
      where: whereClause,
      select: {
        id: true,
        fullName: true,
        empCode: true,
        departmentId: true,
        designation: true,
        isActive: true,
      },
      orderBy: { fullName: "asc" },
    });

    return NextResponse.json(employees);
  } catch (error) {
    console.error("Failed to fetch employees:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    {
      message:
        "Employee records are managed via ZKBio and cannot be created from this system. " +
        "Please add the employee in ZKBio first — they will appear here automatically.",
    },
    { status: 405 }
  );
}
