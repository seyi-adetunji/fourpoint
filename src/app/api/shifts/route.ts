import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUTCMidnight } from "@/lib/dateUtils";
import { syncZKBioTimeInsert } from "@/lib/zkbiotime";
import {
  deleteShiftAssignmentsSafely,
  invalidateShiftIntegrityCache,
  resequenceEmployeeDays,
} from "@/lib/shiftIntegrity";

// GET: Fetch all shift templates (for dropdowns & modals)
export async function GET() {
  try {
    const templates = await prisma.shiftTemplate.findMany({
      orderBy: [{ startTime: "asc" }, { code: "asc" }],
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

// POST: Create a single shift assignment with full normalization & ZKBioTime sync
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (
      !session ||
      !["SUPER_ADMIN", "HR_ADMIN", "HOD", "DEPT_ADMIN", "SUPERVISOR"].includes(
        role
      )
    ) {
      return NextResponse.json(
        { message: "Unauthorized. Insufficient permissions." },
        { status: 403 }
      );
    }

    const creatorUserId =
      ((session.user as any)?.id as string | undefined) ?? null;
    const isDeptScoped = ["HOD", "DEPT_ADMIN", "SUPERVISOR"].includes(role);
    const userDeptId = (session.user as any)?.departmentId as
      | number
      | null
      | undefined;

    const body = await req.json();
    const { employeeId: rawEmpId, shiftTemplateId, date } = body;
    const employeeId = Number(rawEmpId);

    if (!employeeId || isNaN(employeeId) || !shiftTemplateId || !date) {
      return NextResponse.json(
        { message: "Employee, shift template, and date are required" },
        { status: 400 }
      );
    }

    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, departmentId: true },
    });
    if (!emp) {
      return NextResponse.json(
        { message: "Employee not found." },
        { status: 404 }
      );
    }
    if (isDeptScoped && userDeptId && emp.departmentId !== userDeptId) {
      return NextResponse.json(
        { message: "Cannot assign shifts outside your department." },
        { status: 403 }
      );
    }

    const dateStr = String(date).trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ message: "Invalid date" }, { status: 400 });
    }
    const workDate = getUTCMidnight(dateStr);

    // Clean any CANCELLED rows on that day first
    const cancelled = await prisma.shiftAssignment.findMany({
      where: { employeeId, workDate, status: "CANCELLED" },
      select: { id: true },
    });
    if (cancelled.length > 0) {
      await deleteShiftAssignmentsSafely(cancelled.map((c) => c.id));
    }

    // Check existing active shifts on this day
    const existingActive = await prisma.shiftAssignment.findMany({
      where: { employeeId, workDate, status: { not: "CANCELLED" } },
      select: { id: true, shiftTemplateId: true, sequence: true },
    });

    if (existingActive.some((a) => a.shiftTemplateId === shiftTemplateId)) {
      return NextResponse.json(
        {
          message:
            "This employee already has this shift assigned on that date.",
        },
        { status: 409 }
      );
    }

    const nextSequence =
      existingActive.reduce((max, a) => Math.max(max, a.sequence), 0) + 1;

    const assignment = await prisma.shiftAssignment.create({
      data: {
        employeeId,
        shiftTemplateId,
        workDate,
        sequence: nextSequence,
        status: "SCHEDULED",
        assignedByUserId: creatorUserId,
      },
      include: {
        employee: true,
        shiftTemplate: true,
      },
    });

    await resequenceEmployeeDays([{ employeeId, workDate }]);

    await syncZKBioTimeInsert([
      {
        employeeId,
        workDate,
        shiftTemplateName: assignment.shiftTemplate.name,
      },
    ]);

    invalidateShiftIntegrityCache();
    revalidatePath("/");
    revalidatePath("/shifts");
    revalidatePath("/shift-list");
    revalidatePath("/reports");

    return NextResponse.json(assignment, { status: 201 });
  } catch (error: unknown) {
    console.error("Failed to create shift assignment:", error);
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
