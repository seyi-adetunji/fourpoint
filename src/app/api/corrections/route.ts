import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.employeeId) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 403 });
    }

    const body = await req.json();
    const { attendanceResultId, reason, proposedTimeIn, proposedTimeOut } = body;

    if (!attendanceResultId || !reason) {
      return NextResponse.json({ message: "Result ID and reason are required." }, { status: 400 });
    }

    const correction = await prisma.attendanceCorrection.create({
      data: {
        employeeId: session.user.employeeId,
        attendanceResultId,
        reason,
        proposedTimeIn: proposedTimeIn ? new Date(proposedTimeIn) : null,
        proposedTimeOut: proposedTimeOut ? new Date(proposedTimeOut) : null,
        status: "PENDING"
      }
    });

    return NextResponse.json(correction, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create correction request:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.employeeId) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 403 });
    }

    const corrections = await prisma.attendanceCorrection.findMany({
      where: { employeeId: session.user.employeeId },
      orderBy: { createdAt: "desc" },
      include: {
        attendanceResult: true
      }
    });

    return NextResponse.json(corrections);
  } catch (error: any) {
    console.error("Failed to fetch correction requests:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
