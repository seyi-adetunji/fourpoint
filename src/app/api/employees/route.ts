import { NextResponse } from "next/server";
import { EmployeeService } from "@/services/employeeService";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !["SUPER_ADMIN", "HR_ADMIN"].includes(session.user.role as string)) {
      return NextResponse.json({ message: "Unauthorized. HR or Admin role required." }, { status: 403 });
    }

    const body = await req.json();
    const { code, name, department } = body;

    if (!code || !name) {
      return NextResponse.json(
        { message: "Code and Name are required" },
        { status: 400 }
      );
    }

    const employee = await EmployeeService.createEmployee({
      empCode: code,
      fullName: name,
      department: department ? { connect: { id: department } } : undefined
    }, session.user.id);

    return NextResponse.json(employee, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create employee:", error);
    if (error.message.includes("already exists")) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
