import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncZKBioTimeDelete, syncZKBioTimeInsert } from "@/lib/zkbiotime";
import {
  deleteShiftAssignmentsSafely,
  invalidateShiftIntegrityCache,
  resequenceEmployeeDays,
} from "@/lib/shiftIntegrity";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await req.json();
    const { shiftTemplateId } = body as {
      shiftTemplateId?: string;
      sequence?: number;
    };

    const old = await prisma.shiftAssignment.findUnique({
      where: { id },
      include: {
        employee: { select: { departmentId: true } },
        shiftTemplate: { select: { name: true } },
      },
    });

    if (!old) {
      return NextResponse.json(
        { message: "Shift assignment not found." },
        { status: 404 }
      );
    }

    if (
      isDeptScoped &&
      userDeptId &&
      old.employee.departmentId !== userDeptId
    ) {
      return NextResponse.json(
        { message: "Cannot modify shifts outside your department." },
        { status: 403 }
      );
    }

    // Prevent changing template to one already assigned to this employee on the same date
    if (shiftTemplateId && shiftTemplateId !== old.shiftTemplateId) {
      const siblingConflict = await prisma.shiftAssignment.findFirst({
        where: {
          employeeId: old.employeeId,
          workDate: old.workDate,
          shiftTemplateId,
          status: { not: "CANCELLED" },
          id: { not: id },
        },
        select: { id: true },
      });

      if (siblingConflict) {
        return NextResponse.json(
          {
            message:
              "This employee already has that shift template assigned on this date.",
          },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.shiftAssignment.update({
      where: { id },
      data: {
        ...(shiftTemplateId ? { shiftTemplateId } : {}),
      },
      include: { shiftTemplate: { select: { name: true } } },
    });

    // Update any linked AttendanceResult template & re-sequence chronologically
    if (shiftTemplateId && shiftTemplateId !== old.shiftTemplateId) {
      await prisma.attendanceResult.updateMany({
        where: { shiftAssignmentId: id },
        data: { shiftTemplateId },
      });
    }

    await resequenceEmployeeDays([
      { employeeId: updated.employeeId, workDate: updated.workDate },
    ]);

    // ZKBioTime Sync on template change
    if (shiftTemplateId && old.shiftTemplateId !== shiftTemplateId) {
      await syncZKBioTimeDelete([
        {
          employeeId: old.employeeId,
          workDate: old.workDate,
          shiftTemplateName: old.shiftTemplate.name,
        },
      ]);
      await syncZKBioTimeInsert([
        {
          employeeId: updated.employeeId,
          workDate: updated.workDate,
          shiftTemplateName: updated.shiftTemplate.name,
        },
      ]);
    }

    invalidateShiftIntegrityCache();
    revalidatePath("/");
    revalidatePath("/shifts");
    revalidatePath("/shift-list");
    revalidatePath("/attendance/results");
    revalidatePath("/reports");

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Failed to update shift assignment:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        {
          message:
            "This employee already has a shift assigned on that date with the same sequence number.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const existing = await prisma.shiftAssignment.findUnique({
      where: { id },
      include: { employee: { select: { departmentId: true } } },
    });

    if (!existing) {
      return NextResponse.json({ success: true, deleted: 0 });
    }

    if (
      isDeptScoped &&
      userDeptId &&
      existing.employee.departmentId !== userDeptId
    ) {
      return NextResponse.json(
        { message: "Cannot delete shifts outside your department." },
        { status: 403 }
      );
    }

    const deletedCount = await deleteShiftAssignmentsSafely([id]);

    revalidatePath("/");
    revalidatePath("/shifts");
    revalidatePath("/shift-list");
    revalidatePath("/attendance/punches");
    revalidatePath("/attendance/results");
    revalidatePath("/reports");

    return NextResponse.json({ success: true, deleted: deletedCount });
  } catch (error: any) {
    console.error("Failed to delete shift assignment:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
