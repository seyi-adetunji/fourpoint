import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { exceptionId, resolutionNotes, action } = body;

    if (!exceptionId || !action) {
      return NextResponse.json(
        { message: "Exception ID and action are required" },
        { status: 400 }
      );
    }

    // Typical actions: "IGNORE" (mark resolved, keep result), "FIX_PUNCH_IN", "FIX_PUNCH_OUT"
    // For this simple version, we'll just mark it resolved with notes.
    
    // Check if exception exists
    const exception = await prisma.attendanceException.findUnique({
      where: { id: exceptionId },
      include: {
        attendanceResult: true
      }
    });

    if (!exception) {
      return NextResponse.json(
        { message: "Exception not found" },
        { status: 404 }
      );
    }

    // Update Exception
    const updatedEx = await prisma.attendanceException.update({
      where: { id: exceptionId },
      data: {
        status: "RESOLVED",
        // resolvedByUserId would normally come from session, e.g. session.user.id
        // but for now we'll just omit it if we don't have getServerSession
        resolvedAt: new Date(),
        resolutionNote: `${exception.details || ""} | Resolved: ${resolutionNotes || action}`
      }
    });

    // Option: If it was a missing punch and we "FIXED" it, we might want to change result status to PRESENT.
    // Simplifying here to just resolving the exception ticket.
    if (action === "OVERRIDE_STATUS_PRESENT" && exception.attendanceResultId) {
        await prisma.attendanceResult.update({
            where: { id: exception.attendanceResultId },
            data: { status: "PRESENT" }
        });
    }

    return NextResponse.json({ success: true, exception: updatedEx }, { status: 200 });
  } catch (error) {
    console.error("Failed to resolve exception:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
