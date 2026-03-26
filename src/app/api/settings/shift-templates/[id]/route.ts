import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// PUT: Update an existing shift template
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { code, name, startTime, endTime, graceLate, graceEarly } = body;

    const template = await prisma.shiftTemplate.update({
      where: { id },
      data: {
        code,
        name,
        startTime,
        endTime,
        graceLate,
        graceEarly,
      },
    });

    return NextResponse.json(template);
  } catch (error: any) {
    console.error("Failed to update shift template:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        { message: "A shift template with this code already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a shift template
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.shiftTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete shift template:", error);
    // Handle foreign key constraint error
    if (error.code === "P2003") {
      return NextResponse.json(
        { message: "Cannot delete template: it is currently assigned to shifts." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
