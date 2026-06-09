import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    // Only allow HODs, Supervisors and Admins
    if (!["SUPER_ADMIN", "HR_ADMIN", "HOD", "DEPT_ADMIN", "SUPERVISOR"].includes(role)) {
      return NextResponse.json({ message: "Unauthorized. Insufficient permissions." }, { status: 403 });
    }

    const body = await req.json();
    const { assignmentIds } = body as { assignmentIds: string[] };

    if (!Array.isArray(assignmentIds) || assignmentIds.length === 0) {
      return NextResponse.json({ message: "No assignment IDs provided." }, { status: 400 });
    }

    await prisma.shiftAssignment.deleteMany({
      where: { id: { in: assignmentIds } },
    });

    revalidatePath("/shifts");

    return NextResponse.json({ success: true, deleted: assignmentIds.length });
  } catch (err) {
    console.error("[POST /api/shifts/bulk-delete]", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
