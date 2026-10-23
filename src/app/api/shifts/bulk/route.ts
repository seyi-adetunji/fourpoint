import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { syncZKBioTimeInsert } from "@/lib/zkbiotime";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUTCMidnight } from "@/lib/dateUtils";
import {
  deleteShiftAssignmentsSafely,
  invalidateShiftIntegrityCache,
  resequenceEmployeeDays,
} from "@/lib/shiftIntegrity";

/**
 * POST /api/shifts/bulk
 * Body: { employeeIds: (number|string)[], shiftTemplateIds: string[], dates: string[], status?: string }
 *
 * Guarantees:
 *   - All `workDate` values are normalized to exact UTC midnight (`@db.Date`).
 *   - Department-scoped users (`HOD`, `DEPT_ADMIN`, `SUPERVISOR`) can only assign shifts to their own department.
 *   - Dead `CANCELLED` rows on target dates are cleaned up before assignment.
 *   - Duplicate same-template assignments on the same `(employeeId, workDate, shiftTemplateId)` are skipped
 *     automatically so re-assigning a shift never creates fake "Double Shifts".
 *   - Legitimate Double Shifts (`Morning` + `Afternoon`) are sequenced chronologically (`1`, `2`).
 *   - Syncs `public.att_temporaryschedule` for ZKBioTime Canteen meal tickets.
 */
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
    const {
      employeeIds: rawEmployeeIds,
      shiftTemplateIds: rawTemplateIds,
      dates,
      status = "SCHEDULED",
    } = body as {
      employeeIds: Array<string | number>;
      shiftTemplateIds: string[];
      dates: string[];
      status?: string;
    };

    const requestedEmpIds = Array.from(
      new Set((rawEmployeeIds || []).map(Number).filter((n) => !isNaN(n)))
    );
    const shiftTemplateIds = Array.from(
      new Set((rawTemplateIds || []).filter(Boolean))
    );

    if (
      requestedEmpIds.length === 0 ||
      shiftTemplateIds.length === 0 ||
      !Array.isArray(dates) ||
      dates.length === 0
    ) {
      return NextResponse.json(
        {
          message:
            "employeeIds, shiftTemplateIds, and dates are all required arrays.",
        },
        { status: 400 }
      );
    }

    // Validate employees & enforce department scope for HOD / Supervisor
    const validEmployees = await prisma.employee.findMany({
      where: {
        id: { in: requestedEmpIds },
        ...(isDeptScoped && userDeptId ? { departmentId: userDeptId } : {}),
      },
      select: { id: true },
    });
    const employeeIds = validEmployees.map((e) => e.id);

    if (employeeIds.length === 0) {
      return NextResponse.json(
        { message: "No valid employees found in your authorized scope." },
        { status: 403 }
      );
    }

    // Validate shift templates & sort chronologically by startTime
    const templates = await prisma.shiftTemplate.findMany({
      where: { id: { in: shiftTemplateIds } },
      select: { id: true, name: true, startTime: true },
    });
    if (templates.length === 0) {
      return NextResponse.json(
        { message: "No valid shift templates selected." },
        { status: 400 }
      );
    }
    const orderedTemplates = [...templates].sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    );
    const templateMap = new Map(orderedTemplates.map((t) => [t.id, t.name]));

    // Normalize and deduplicate dates to UTC midnight
    const uniqueDateStrs = Array.from(
      new Set(
        dates
          .map((d) => String(d).trim().slice(0, 10))
          .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      )
    );
    const parsedDates = uniqueDateStrs.map((d) => getUTCMidnight(d));

    if (parsedDates.length === 0) {
      return NextResponse.json(
        { message: "No valid dates provided." },
        { status: 400 }
      );
    }

    // 1. Clean up any dead CANCELLED rows on these (employee, date) pairs first
    const cancelledExisting = await prisma.shiftAssignment.findMany({
      where: {
        employeeId: { in: employeeIds },
        workDate: { in: parsedDates },
        status: "CANCELLED",
      },
      select: { id: true },
    });
    if (cancelledExisting.length > 0) {
      await deleteShiftAssignmentsSafely(cancelledExisting.map((c) => c.id));
    }

    // 2. Fetch existing active assignments for all (employee, date) pairs
    const existing = await prisma.shiftAssignment.findMany({
      where: {
        employeeId: { in: employeeIds },
        workDate: { in: parsedDates },
        status: { not: "CANCELLED" },
      },
      select: {
        employeeId: true,
        workDate: true,
        sequence: true,
        shiftTemplateId: true,
      },
    });

    const existingMaxSeq = new Map<string, number>();
    const existingTemplatesSet = new Set<string>();
    for (const e of existing) {
      const dStr = e.workDate.toISOString().slice(0, 10);
      const dayKey = `${e.employeeId}|${dStr}`;
      const cur = existingMaxSeq.get(dayKey) ?? 0;
      if (e.sequence > cur) existingMaxSeq.set(dayKey, e.sequence);
      existingTemplatesSet.add(`${dayKey}|${e.shiftTemplateId}`);
    }

    // 3. Build only non-duplicate records
    const nextSeq = new Map<string, number>();
    const normalizedStatus =
      status === "CONFIRMED" || status === "SWAPPED" ? status : "SCHEDULED";

    const records: {
      employeeId: number;
      shiftTemplateId: string;
      workDate: Date;
      sequence: number;
      status: string;
      assignedByUserId: string | null;
    }[] = [];

    let skippedDuplicates = 0;

    for (const empId of employeeIds) {
      for (const date of parsedDates) {
        const dStr = date.toISOString().slice(0, 10);
        const dateKey = `${empId}|${dStr}`;

        if (!nextSeq.has(dateKey)) {
          nextSeq.set(dateKey, (existingMaxSeq.get(dateKey) ?? 0) + 1);
        }

        for (const tpl of orderedTemplates) {
          const tplKey = `${dateKey}|${tpl.id}`;
          if (existingTemplatesSet.has(tplKey)) {
            skippedDuplicates += 1;
            continue;
          }
          existingTemplatesSet.add(tplKey);

          const seq = nextSeq.get(dateKey)!;
          records.push({
            employeeId: empId,
            shiftTemplateId: tpl.id,
            workDate: date,
            sequence: seq,
            status: normalizedStatus,
            assignedByUserId: creatorUserId,
          });
          nextSeq.set(dateKey, seq + 1);
        }
      }
    }

    if (records.length === 0) {
      return NextResponse.json(
        {
          created: 0,
          skipped: skippedDuplicates,
          total: 0,
          message:
            skippedDuplicates > 0
              ? "Selected shift(s) are already assigned on the chosen date(s)."
              : "No new shift assignments to create.",
        },
        { status: 200 }
      );
    }

    const result = await prisma.shiftAssignment.createMany({
      data: records,
      skipDuplicates: true,
    });

    // 4. Ensure chronological sequence numbering (Morning = 1, Afternoon = 2)
    await resequenceEmployeeDays(
      records.map((r) => ({ employeeId: r.employeeId, workDate: r.workDate }))
    );

    // 5. Sync ZKBioTime temporary schedule for Canteen meal tickets
    if (result.count > 0) {
      const syncEntries = records
        .map((r) => ({
          employeeId: r.employeeId,
          workDate: r.workDate,
          shiftTemplateName: templateMap.get(r.shiftTemplateId) ?? "",
        }))
        .filter((e) => e.shiftTemplateName !== "");

      await syncZKBioTimeInsert(syncEntries);
    }

    invalidateShiftIntegrityCache();

    revalidatePath("/");
    revalidatePath("/shifts");
    revalidatePath("/shift-list");
    revalidatePath("/attendance/punches");
    revalidatePath("/attendance/results");
    revalidatePath("/reports");

    return NextResponse.json(
      {
        created: result.count,
        skipped: skippedDuplicates,
        total: records.length,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/shifts/bulk]", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
