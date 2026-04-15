import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { employeeId, workDate, type, correctedTime, reason } = body;

    if (!employeeId || !workDate || !type || !correctedTime) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Parse the corrected time into a full DateTime
    const [hours, minutes] = correctedTime.split(":").map(Number);
    const dateObj = new Date(workDate);
    dateObj.setHours(hours, minutes, 0, 0);

    // Auto-approve for admins, keep pending for HODs
    const isAdmin = session.user.role === "SUPER_ADMIN" || session.user.role === "HR_ADMIN";

    const correction = await prisma.attendanceCorrection.create({
      data: {
        employeeId: parseInt(employeeId),
        workDate: new Date(workDate),
        type,
        correctedTime: dateObj,
        reason,
        requestedByUserId: session.user.id,
        status: isAdmin ? "APPROVED" : "PENDING",
        ...(isAdmin && { approvedByUserId: session.user.id, approvalNote: "Auto-approved by Admin" })
      }
    });

    // If approved, we should also trigger an attendance recalculation (stub for now)
    // if (isAdmin) { await triggerRecalculation(employeeId, workDate); }

    return NextResponse.json(correction);
  } catch (error: any) {
    console.error("Adjustment Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
