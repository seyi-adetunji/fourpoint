import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET: Fetch all shift templates
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

// POST: Create a new shift template
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, name, startTime, endTime, color, graceLate, graceEarly } = body;

    if (!code || !name || !startTime || !endTime) {
      return NextResponse.json(
        { message: "code, name, startTime, and endTime are required" },
        { status: 400 }
      );
    }

    const template = await prisma.shiftTemplate.create({
      data: {
        code,
        name,
        startTime,
        endTime,
        color: color || "#6B7280",
        graceLate: graceLate ?? 15,
        graceEarly: graceEarly ?? 15,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create shift template:", error);
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
