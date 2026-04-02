import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * POST /api/shifts/bulk
 * Body: { employeeIds: string[], shiftTemplateIds: string[], dates: string[] }
 *
 * For each (employeeId × date) pair, the templates are stacked with auto-incremented
 * sequence numbers, starting after any already-existing assignments for that pair.
 * e.g. if 2 templates selected and employee already has seq=1 on that date, the
 * new ones get seq=2 and seq=3.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { employeeIds, shiftTemplateIds, dates, status = "SCHEDULED" } = body as {
      employeeIds: string[];
      shiftTemplateIds: string[];
      dates: string[];
      status?: string;
    };

    if (
      !Array.isArray(employeeIds) || employeeIds.length === 0 ||
      !Array.isArray(shiftTemplateIds) || shiftTemplateIds.length === 0 ||
      !Array.isArray(dates) || dates.length === 0
    ) {
      return NextResponse.json(
        { message: "employeeIds, shiftTemplateIds, and dates are all required arrays." },
        { status: 400 }
      );
    }

    // Parse and validate dates
    const parsedDates = dates
      .map((d) => new Date(d))
      .filter((d) => !isNaN(d.getTime()));

    if (parsedDates.length === 0) {
      return NextResponse.json({ message: "No valid dates provided." }, { status: 400 });
    }

    // ── Fetch existing sequence numbers for all (employee, date) pairs ──────────
    const existing = await prisma.shiftAssignment.findMany({
      where: {
        employeeId: { in: employeeIds },
        workDate: { in: parsedDates },
      },
      select: { employeeId: true, workDate: true, sequence: true },
    });

    // Build a lookup: "empId|date" => max existing sequence
    const existingMaxSeq = new Map<string, number>();
    for (const e of existing) {
      const key = `${e.employeeId}|${e.workDate.toISOString().slice(0, 10)}`;
      const cur = existingMaxSeq.get(key) ?? 0;
      if (e.sequence > cur) existingMaxSeq.set(key, e.sequence);
    }

    // ── Build records with correct sequence numbers ───────────────────────────
    // Track next sequence per (empId, date) as we build the list
    const nextSeq = new Map<string, number>();

    const records: {
      employeeId: string;
      shiftTemplateId: string;
      workDate: Date;
      sequence: number;
      status: string;
    }[] = [];

    for (const empId of employeeIds) {
      for (const date of parsedDates) {
        const dateKey = `${empId}|${date.toISOString().slice(0, 10)}`;

        // Start after whatever already exists for this pair
        if (!nextSeq.has(dateKey)) {
          nextSeq.set(dateKey, (existingMaxSeq.get(dateKey) ?? 0) + 1);
        }

        for (const tplId of shiftTemplateIds) {
          const seq = nextSeq.get(dateKey)!;
          records.push({
            employeeId: empId,
            shiftTemplateId: tplId,
            workDate: date,
            sequence: seq,
            status: status as any,
          });
          nextSeq.set(dateKey, seq + 1);
        }
      }
    }

    if (records.length === 0) {
      return NextResponse.json({ message: "No valid records to create." }, { status: 400 });
    }

    // Use createMany with skipDuplicates as a safety net
    const result = await prisma.shiftAssignment.createMany({
      data: records,
      skipDuplicates: true,
    });

    return NextResponse.json(
      { created: result.count, total: records.length },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/shifts/bulk]", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
