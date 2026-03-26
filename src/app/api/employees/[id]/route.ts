import { NextResponse } from "next/server";
import { EmployeeService } from "@/services/employeeService";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !["SUPER_ADMIN", "HR_ADMIN"].includes(session.user.role as string)) {
      return NextResponse.json({ message: "Unauthorized. HR or Admin role required." }, { status: 403 });
    }

    const body = await req.json();
    const { name, department } = body;

    const employee = await EmployeeService.updateEmployee(id, {
      ...(name && { name }),
      department: department || null,
    }, session.user.id);

    return NextResponse.json(employee);
  } catch (error: any) {
    console.error("Failed to update employee:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !["SUPER_ADMIN", "HR_ADMIN"].includes(session.user.role as string)) {
      return NextResponse.json({ message: "Unauthorized. HR or Admin role required." }, { status: 403 });
    }

    await EmployeeService.deleteEmployee(id, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete employee:", error);
    if (error.code === "P2003") {
      return NextResponse.json(
        { message: "Cannot delete employee: They have associated shift assignments or attendance records. Archive them instead." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
