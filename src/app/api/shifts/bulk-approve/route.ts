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
 * POST /api/shifts/bulk-approve
 * Body: { action: "approve" | "reject", assignmentIds: string[] }
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (!session || !["SUPER_ADMIN", "HR_ADMIN", "HOD", "DEPT_ADMIN"].includes(role)) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 403 });
    }

    const body = await req.json();
    const { action, assignmentIds } = body as {
      action: "approve" | "reject";
      assignmentIds: string[];
    };

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ message: "Invalid action." }, { status: 400 });
    }

    if (!Array.isArray(assignmentIds) || assignmentIds.length === 0) {
      return NextResponse.json(
        { message: "No assignment IDs provided." },
        { status: 400 }
      );
    }

    if (action === "reject") {
      const deleted = await deleteShiftAssignmentsSafely(assignmentIds);
      revalidatePath("/");
      revalidatePath("/shifts");
      revalidatePath("/shift-list");
      revalidatePath("/reports");
      return NextResponse.json({ success: true, updated: deleted });
    }

    const targets = await prisma.shiftAssignment.findMany({
      where: { id: { in: assignmentIds } },
      include: { shiftTemplate: { select: { name: true } } },
    });

    await prisma.shiftAssignment.updateMany({
      where: { id: { in: assignmentIds } },
      data: { status: "SCHEDULED" },
    });

    await syncZKBioTimeInsert(
      targets.map((t) => ({
        employeeId: t.employeeId,
        workDate: t.workDate,
        shiftTemplateName: t.shiftTemplate.name,
      }))
    );

    invalidateShiftIntegrityCache();
    revalidatePath("/");
    revalidatePath("/shifts");
    revalidatePath("/shift-list");
    revalidatePath("/reports");

    return NextResponse.json({ success: true, updated: targets.length });
  } catch (err) {
    console.error("[POST /api/shifts/bulk-approve]", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
