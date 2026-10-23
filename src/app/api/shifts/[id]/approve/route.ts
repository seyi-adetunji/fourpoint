import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncZKBioTimeInsert } from "@/lib/zkbiotime";
import {
  deleteShiftAssignmentsSafely,
  invalidateShiftIntegrityCache,
} from "@/lib/shiftIntegrity";

/**
 * POST /api/shifts/[id]/approve
 * Body: { action: "approve" | "reject" }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (!session || !["SUPER_ADMIN", "HR_ADMIN", "HOD", "DEPT_ADMIN"].includes(role)) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action } = body as { action: "approve" | "reject" };

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ message: "Invalid action." }, { status: 400 });
    }

    const assignment = await prisma.shiftAssignment.findUnique({
      where: { id },
      include: { shiftTemplate: { select: { name: true } } },
    });
    if (!assignment) {
      return NextResponse.json(
        { message: "Assignment not found." },
        { status: 404 }
      );
    }

    if (action === "reject") {
      await deleteShiftAssignmentsSafely([id]);
      revalidatePath("/");
      revalidatePath("/shifts");
      revalidatePath("/shift-list");
      revalidatePath("/reports");
      return NextResponse.json({ id, status: "CANCELLED", deleted: true });
    }

    const updated = await prisma.shiftAssignment.update({
      where: { id },
      data: { status: "SCHEDULED" },
    });

    await syncZKBioTimeInsert([
      {
        employeeId: assignment.employeeId,
        workDate: assignment.workDate,
        shiftTemplateName: assignment.shiftTemplate.name,
      },
    ]);

    invalidateShiftIntegrityCache();
    revalidatePath("/");
    revalidatePath("/shifts");
    revalidatePath("/shift-list");
    revalidatePath("/reports");

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[POST /api/shifts/[id]/approve]", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
