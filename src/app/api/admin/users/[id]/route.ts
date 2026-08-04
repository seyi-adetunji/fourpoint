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

    try {
      await prisma.user.delete({
        where: { id },
      });
    } catch (dbError: any) {
      // P2003 is Prisma's error code for foreign key constraint failure
      if (dbError.code === "P2003") {
        await prisma.user.update({
          where: { id },
          data: { 
            isActive: false,
            passwordHash: "DEACTIVATED_USER", 
          }
        });
        return NextResponse.json({ success: true, softDeleted: true });
      }
      throw dbError;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete user:", error);
    return NextResponse.json(
      { message: "Internal server error" },
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
