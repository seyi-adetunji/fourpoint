import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(departments);
  } catch (error) {
    console.error("Failed to fetch departments:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !["SUPER_ADMIN", "HR_ADMIN"].includes(session.user.role as string)) {
      return NextResponse.json({ message: "Unauthorized. HR or Admin role required." }, { status: 403 });
    }

    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { message: "Department name is required" },
        { status: 400 }
      );
    }

    const deptCode = name.trim().replace(/\s+/g, "").substring(0, 3).toUpperCase();

    const department = await prisma.department.create({
      data: { 
        name: name.trim(),
        code: deptCode 
      },
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create department:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        { message: "A department with this name already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
