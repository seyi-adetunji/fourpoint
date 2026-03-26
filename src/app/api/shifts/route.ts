import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET: Fetch all shift templates (for the form dropdown)
export async function GET() {
  try {
    const templates = await prisma.shiftTemplate.findMany({
      orderBy: { code: "asc" },
    });
    return NextResponse.json(templates);
  } catch (error) {
    console.error("Failed to fetch shift templates:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: Create a new shift assignment
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { employeeId, shiftTemplateId, date, sequence } = body;

    if (!employeeId || !shiftTemplateId || !date) {
      return NextResponse.json(
        { message: "Employee, shift template, and date are required" },
        { status: 400 }
      );
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ message: "Invalid date" }, { status: 400 });
    }

    const assignment = await prisma.shiftAssignment.create({
      data: {
        employeeId,
        shiftTemplateId,
        date: parsedDate,
        sequence: sequence ?? 1,
      },
      include: {
        employee: true,
        shiftTemplate: true,
      },
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error: unknown) {
    console.error("Failed to create shift assignment:", error);
    // Handle unique constraint violation (duplicate assignment)
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          message:
            "This employee already has a shift assigned on that date with the same sequence number.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
