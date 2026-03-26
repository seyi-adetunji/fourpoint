import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !["SUPER_ADMIN", "HR_ADMIN"].includes(session.user.role as string)) {
      return NextResponse.json({ message: "Unauthorized. HR or Admin role required." }, { status: 403 });
    }

    // Optional: check if there are employees using this department name
    // Since department on Employee is just a string, we might not block deletion,
    // or we might warn. For now, we simply delete it from the selectable list.
    await prisma.department.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete department:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
