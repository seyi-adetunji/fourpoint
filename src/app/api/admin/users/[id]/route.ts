import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session || !["SUPER_ADMIN", "HR_ADMIN"].includes(session.user.role as string)) {
      return NextResponse.json({ message: "Unauthorized. HR or Admin role required." }, { status: 403 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    if (targetUser.role === "SUPER_ADMIN" && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ message: "Only Super Admins can delete Super Admins" }, { status: 403 });
    }

    // Prevent deleting oneself
    if (targetUser.id === session.user.id) {
      return NextResponse.json({ message: "Cannot delete your own account" }, { status: 400 });
    }

    // 1. Detach optional references that don't need to keep the user link
    await prisma.$transaction([
      prisma.attendanceException.updateMany({ where: { assignedToUserId: id }, data: { assignedToUserId: null } }),
      prisma.attendanceException.updateMany({ where: { resolvedByUserId: id }, data: { resolvedByUserId: null } }),
      prisma.attendanceCorrection.updateMany({ where: { approvedByUserId: id }, data: { approvedByUserId: null } }),
      prisma.leaveRequest.updateMany({ where: { approvedByUserId: id }, data: { approvedByUserId: null } }),
    ]);

    // 2. History we want to keep (audit trail, requests raised, shifts created by this user)
    const [auditCount, leaveReqCount, corrReqCount, shiftCount] = await Promise.all([
      prisma.auditLog.count({ where: { userId: id } }),
      prisma.leaveRequest.count({ where: { requestedByUserId: id } }),
      prisma.attendanceCorrection.count({ where: { requestedByUserId: id } }),
      prisma.shiftAssignment.count({ where: { assignedByUserId: id } }),
    ]);

    const archive = async () => {
      // Keep the row for history, but remove access and free the email / employee link
      await prisma.user.update({
        where: { id },
        data: {
          isActive: false,
          passwordHash: "DEACTIVATED_USER",
          email: `deleted-${Date.now()}-${targetUser.email}`,
          employeeId: null,
        },
      });
      return NextResponse.json({ success: true, softDeleted: true });
    };

    if (auditCount + leaveReqCount + corrReqCount + shiftCount > 0) {
      return await archive();
    }

    try {
      await prisma.user.delete({ where: { id } });
    } catch (dbError: any) {
      // Any remaining FK constraint (P2003 / P2014) → archive instead
      if (["P2003", "P2014"].includes(dbError?.code)) {
        return await archive();
      }
      throw dbError;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete user:", error);
    return NextResponse.json(
      { message: `Failed to delete user: ${error?.message ?? "Internal server error"}` },
      { status: 500 }
    );
  }
}

import bcrypt from "bcryptjs";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session || !["SUPER_ADMIN", "HR_ADMIN"].includes(session.user.role as string)) {
      return NextResponse.json({ message: "Unauthorized. HR or Admin role required." }, { status: 403 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    if (targetUser.role === "SUPER_ADMIN" && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ message: "Only Super Admins can edit Super Admins" }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, role, password, employeeId, departmentId } = body;

    // Only SUPER_ADMIN can assign SUPER_ADMIN role
    if (role === "SUPER_ADMIN" && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ message: "Only Super Admins can assign Super Admin role" }, { status: 403 });
    }

    const updateData: any = {
      name,
      email,
      role,
      employeeId: employeeId ? parseInt(employeeId) : null,
      departmentId: departmentId ? parseInt(departmentId) : null,
    };

    if (password && password.trim() !== "") {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ message: "User with this email already exists" }, { status: 400 });
    }
    console.error("Failed to update user:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
