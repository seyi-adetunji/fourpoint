import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteShiftAssignmentsSafely } from "@/lib/shiftIntegrity";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (
      !session ||
      !["SUPER_ADMIN", "HR_ADMIN", "HOD", "DEPT_ADMIN", "SUPERVISOR"].includes(
        role
      )
    ) {
      return NextResponse.json(
        { message: "Unauthorized. Insufficient permissions." },
        { status: 403 }
      );
    }

    const isDeptScoped = ["HOD", "DEPT_ADMIN", "SUPERVISOR"].includes(role);
    const userDeptId = (session.user as any)?.departmentId as
      | number
      | null
      | undefined;

    const body = await req.json();
    const { assignmentIds } = body as { assignmentIds: string[] };

    if (!Array.isArray(assignmentIds) || assignmentIds.length === 0) {
      return NextResponse.json(
        { message: "No assignment IDs provided." },
        { status: 400 }
      );
    }

    // Scope to authorized department if HOD / Dept Admin / Supervisor
    const authorized = await prisma.shiftAssignment.findMany({
      where: {
        id: { in: assignmentIds },
        ...(isDeptScoped && userDeptId
          ? { employee: { departmentId: userDeptId } }
          : {}),
      },
      select: { id: true },
    });

    const deletedCount = await deleteShiftAssignmentsSafely(
      authorized.map((a) => a.id)
    );

    revalidatePath("/");
    revalidatePath("/shifts");
    revalidatePath("/shift-list");
    revalidatePath("/attendance/punches");
    revalidatePath("/attendance/results");
    revalidatePath("/reports");

    return NextResponse.json({ success: true, deleted: deletedCount });
  } catch (err) {
    console.error("[POST /api/shifts/bulk-delete]", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
