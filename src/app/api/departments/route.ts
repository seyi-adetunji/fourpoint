/**
 * GET  /api/departments  → list all departments (read from ZKBio public schema)
 * POST /api/departments  → 405 — departments are managed in ZKBio, not here
 */
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(departments);
  } catch (error) {
    console.error("Failed to fetch departments:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// Departments live in ZKBio (public schema — read-only).
// Creation/deletion must be performed in the ZKBio system.
export async function POST() {
  return NextResponse.json(
    { message: "Departments are managed via ZKBio and are read-only in this system." },
    { status: 405 }
  );
}
