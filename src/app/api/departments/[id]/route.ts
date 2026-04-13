/**
 * DELETE /api/departments/[id]  → 405
 *
 * Departments are stored in the ZKBio public schema (personnel_department)
 * which is READ-ONLY in this application. Deletion must be done in ZKBio.
 */
import { NextResponse } from "next/server";

export async function DELETE() {
  return NextResponse.json(
    { message: "Departments are managed via ZKBio and cannot be deleted from this system." },
    { status: 405 }
  );
}
