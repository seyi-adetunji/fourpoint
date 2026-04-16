/**
 * GET  /api/employees  → list employees (read from workforce schema)
 * POST /api/employees  → 405 (employees are managed in ZKBio)
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || undefined;
    const department = searchParams.get("department") || undefined;

    const whereClause: any = {};
    if (q) {
      whereClause.OR = [
        { fullName: { contains: q, mode: "insensitive" } },
        { empCode: { contains: q, mode: "insensitive" } },
      ];
    }
    if (department) {
      whereClause.departmentId = parseInt(department);
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
