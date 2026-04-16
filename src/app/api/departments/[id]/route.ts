import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "SUPER_ADMIN" && (session.user as any).role !== "HR_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { deptManagerId } = body;

    const department = await prisma.department.update({
      where: { id: parseInt(id) },
      data: {
        deptManagerId: deptManagerId ? parseInt(deptManagerId) : null,
      },
    });

    return NextResponse.json(department);
  } catch (error: any) {
    console.error("Department Update Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
