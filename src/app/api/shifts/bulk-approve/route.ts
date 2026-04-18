import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

/**
 * POST /api/shifts/bulk-approve
 * Body: { action: "approve" | "reject", assignmentIds: string[] }
 * Bulk update shift assignment statuses
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, assignmentIds } = body as { action: "approve" | "reject", assignmentIds: string[] };

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ message: "Invalid action." }, { status: 400 });
    }

    if (!Array.isArray(assignmentIds) || assignmentIds.length === 0) {
      return NextResponse.json({ message: "No assignment IDs provided." }, { status: 400 });
    }

    const newStatus = action === "approve" ? "SCHEDULED" : "CANCELLED";

    await prisma.shiftAssignment.updateMany({
      where: { id: { in: assignmentIds } },
      data: { status: newStatus },
    });

    revalidatePath("/shifts");
    revalidatePath("/shifts?status=PENDING_APPROVAL");

    return NextResponse.json({ success: true, updated: assignmentIds.length });
  } catch (err) {
    console.error("[POST /api/shifts/bulk-approve]", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}