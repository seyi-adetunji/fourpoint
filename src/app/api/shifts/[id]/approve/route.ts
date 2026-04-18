import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

/**
 * POST /api/shifts/[id]/approve
 * Body: { action: "approve" | "reject" }
 * Sets shift assignment status to SCHEDULED or CANCELLED
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { action } = body as { action: "approve" | "reject" };

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ message: "Invalid action." }, { status: 400 });
    }

    const assignment = await prisma.shiftAssignment.findUnique({ where: { id } });
    if (!assignment) {
      return NextResponse.json({ message: "Assignment not found." }, { status: 404 });
    }

    const updated = await prisma.shiftAssignment.update({
      where: { id },
      data: {
        status: action === "approve" ? "SCHEDULED" : "CANCELLED",
      },
    });

    revalidatePath("/shifts");
    revalidatePath("/shifts?status=PENDING_APPROVAL");

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[POST /api/shifts/[id]/approve]", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
