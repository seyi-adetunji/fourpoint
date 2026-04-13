/**
 * POST /api/employees  → 405
 *
 * Employees are stored in the ZKBio public schema (personnel_employee)
 * which is READ-ONLY in this application.
 * Employee records must be created/managed in the ZKBio system.
 */
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      message:
        "Employee records are managed via ZKBio and cannot be created from this system. " +
        "Please add the employee in ZKBio first — they will appear here automatically.",
    },
    { status: 405 }
  );
}
