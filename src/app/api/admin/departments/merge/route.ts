import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  executeDepartmentMerge,
  getLastUndoableMerge,
  planDepartmentMerge,
  undoLastDepartmentMerge,
} from "@/lib/departmentMerge";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session?.user || !["SUPER_ADMIN", "HR_ADMIN"].includes(role)) {
    return null;
  }
  return session.user as { id: string };
}

/** GET /api/admin/departments/merge → preview duplicate groups + last undoable merge */
export async function GET() {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  try {
    const [groups, lastMerge] = await Promise.all([
      planDepartmentMerge(),
      getLastUndoableMerge(),
    ]);
    return NextResponse.json({ groups, lastMerge });
  } catch (err: any) {
    console.error("[GET /api/admin/departments/merge]", err);
    return NextResponse.json(
      { message: err?.message || "Failed to analyse departments" },
      { status: 500 }
    );
  }
}

/** POST /api/admin/departments/merge  Body: { action: "merge" | "undo" } */
export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  try {
    const { action } = (await req.json()) as { action?: string };

    const result =
      action === "undo"
        ? await undoLastDepartmentMerge(user.id)
        : action === "merge"
        ? await executeDepartmentMerge(user.id)
        : null;

    if (!result) {
      return NextResponse.json({ message: "Invalid action" }, { status: 400 });
    }

    revalidatePath("/", "layout");
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error("[POST /api/admin/departments/merge]", err);
    return NextResponse.json(
      { message: err?.message || "Department merge failed" },
      { status: 500 }
    );
  }
}
