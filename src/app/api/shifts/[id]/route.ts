import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { syncZKBioTimeDelete, syncZKBioTimeInsert } from "@/lib/zkbiotime";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { shiftTemplateId, sequence } = body;

    // Fetch old assignment so we can remove old ZKBioTime record if template changed
    const old = await prisma.shiftAssignment.findUnique({
      where: { id },
      include: { shiftTemplate: { select: { name: true } } },
    });

    const updated = await prisma.shiftAssignment.update({
      where: { id },
      data: {
        ...(shiftTemplateId && { shiftTemplateId }),
        ...(sequence && { sequence }),
      },
      include: { shiftTemplate: { select: { name: true } } },
    });

    // ── ZKBioTime Sync on template change ──
    if (old && shiftTemplateId && old.shiftTemplateId !== shiftTemplateId) {
      // Remove old interval
      await syncZKBioTimeDelete([{
        employeeId: old.employeeId,
        workDate: old.workDate,
        shiftTemplateName: old.shiftTemplate.name,
      }]);
      // Insert new interval
      await syncZKBioTimeInsert([{
        employeeId: updated.employeeId,
        workDate: updated.workDate,
        shiftTemplateName: updated.shiftTemplate.name,
      }]);
    }

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

    // Fetch before deletion to sync ZKBioTime
    const assignment = await prisma.shiftAssignment.findUnique({
      where: { id },
      include: { shiftTemplate: { select: { name: true } } },
    });

    await prisma.shiftAssignment.delete({ where: { id } });

    // ── ZKBioTime Sync ──
    if (assignment) {
      await syncZKBioTimeDelete([{
        employeeId: assignment.employeeId,
        workDate: assignment.workDate,
        shiftTemplateName: assignment.shiftTemplate.name,
      }]);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete shift assignment:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
