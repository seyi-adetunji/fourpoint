import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { shiftTemplateId, sequence } = body;

    const updated = await prisma.shiftAssignment.update({
      where: { id },
      data: {
        ...(shiftTemplateId && { shiftTemplateId }),
        ...(sequence && { sequence }),
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Failed to update shift assignment:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        { message: "This employee already has a shift assigned on that date with the same sequence number." },
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
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.shiftAssignment.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete shift assignment:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
