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
    const { startDate, endDate, type, reason } = body;

    if (!startDate || !endDate || !type) {
      return NextResponse.json({ message: "Start date, end date, and type are required." }, { status: 400 });
    }

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId: session.user.employeeId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        leaveTypeId: type,
        reason,
        requestedByUserId: session.user.id || 'unknown',
        status: "PENDING"
      }
    });

    return NextResponse.json(leaveRequest, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create leave request:", error);
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

    const requests = await prisma.leaveRequest.findMany({
      where: { employeeId: session.user.employeeId },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(requests);
  } catch (error: any) {
    console.error("Failed to fetch leave requests:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
