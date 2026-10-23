import prisma from "@/lib/prisma";
import { syncZKBioTimeDelete, syncZKBioTimeInsert } from "@/lib/zkbiotime";
import { getUTCMidnight } from "@/lib/dateUtils";

let lastIntegrityCheckMs = 0;
let integrityPromise: Promise<void> | null = null;
const INTEGRITY_TTL_MS = 60_000;

export function invalidateShiftIntegrityCache() {
  lastIntegrityCheckMs = 0;
}

/**
 * Re-sequences all active (`status != "CANCELLED"`) shift assignments for the
 * given `(employeeId, workDate)` pairs into contiguous chronological order (`1, 2, ...`)
 * sorted by `shiftTemplate.startTime` ascending, then `sequence` ascending.
 *
 * Uses a two-pass offset (`+ 1000`) inside a transaction so `@@unique([employeeId, workDate, sequence])`
 * never collides when swapping or compacting sequence numbers.
 */
export async function resequenceEmployeeDays(
  pairs: Array<{ employeeId: number; workDate: Date }>
): Promise<void> {
  if (pairs.length === 0) return;

  const uniquePairs = new Map<string, { employeeId: number; workDate: Date }>();
  for (const p of pairs) {
    const dStr = p.workDate.toISOString().slice(0, 10);
    const key = `${p.employeeId}|${dStr}`;
    if (!uniquePairs.has(key)) {
      uniquePairs.set(key, {
        employeeId: p.employeeId,
        workDate: getUTCMidnight(dStr),
      });
    }
  }

  for (const { employeeId, workDate } of uniquePairs.values()) {
    const active = await prisma.shiftAssignment.findMany({
      where: {
        employeeId,
        workDate,
        status: { not: "CANCELLED" },
      },
      include: {
        shiftTemplate: { select: { startTime: true } },
      },
      orderBy: [{ sequence: "asc" }, { createdAt: "asc" }],
    });

    if (active.length === 0) continue;

    const sorted = [...active].sort((a, b) => {
      const tCmp = a.shiftTemplate.startTime.localeCompare(
        b.shiftTemplate.startTime
      );
      if (tCmp !== 0) return tCmp;
      if (a.sequence !== b.sequence) return a.sequence - b.sequence;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const needsUpdate = sorted.some((row, idx) => row.sequence !== idx + 1);
    if (!needsUpdate) continue;

    await prisma.$transaction(async (tx) => {
      // Pass 1: move to temporary high sequences to avoid unique constraint collision
      for (let i = 0; i < sorted.length; i++) {
        await tx.shiftAssignment.update({
          where: { id: sorted[i].id },
          data: { sequence: 1000 + i + 1 },
        });
      }
      // Pass 2: assign final compact chronological sequences 1..N
      for (let i = 0; i < sorted.length; i++) {
        const finalSeq = i + 1;
        await tx.shiftAssignment.update({
          where: { id: sorted[i].id },
          data: { sequence: finalSeq },
        });
        await tx.attendanceResult.updateMany({
          where: { shiftAssignmentId: sorted[i].id },
          data: { sequence: finalSeq },
        });
      }
    });
  }
}

/**
 * Safely deletes `ShiftAssignment` rows by ID:
 *   1. Cleans up or detaches referencing `AttendanceResult` (and `AttendanceException`) rows
 *      so PostgreSQL foreign keys never fail (`P2003`) and deleted shifts never leave behind
 *      stale `"ABSENT"` / `"NO_SHOW"` records.
 *   2. Deletes the `ShiftAssignment` rows.
 *   3. Compacts sequence numbers (`1, 2, ...`) on affected `(employeeId, workDate)` days.
 *   4. Syncs ZKBioTime `public.att_temporaryschedule` safely.
 */
export async function deleteShiftAssignmentsSafely(
  assignmentIds: string[]
): Promise<number> {
  const uniqueIds = Array.from(new Set(assignmentIds.filter(Boolean)));
  if (uniqueIds.length === 0) return 0;

  const assignments = await prisma.shiftAssignment.findMany({
    where: { id: { in: uniqueIds } },
    include: { shiftTemplate: { select: { name: true } } },
  });

  if (assignments.length === 0) return 0;

  const foundIds = assignments.map((a) => a.id);

  await prisma.$transaction(async (tx) => {
    const linkedResults = await tx.attendanceResult.findMany({
      where: { shiftAssignmentId: { in: foundIds } },
      select: {
        id: true,
        actualIn: true,
        _count: { select: { corrections: true } },
      },
    });

    // Results without any real punch or manual correction were purely generated from the shift (e.g. ABSENT)
    const staleResultIds = linkedResults
      .filter((r) => r.actualIn === null && r._count.corrections === 0)
      .map((r) => r.id);

    // Results with real biometric punches or corrections are preserved as unscheduled attendance
    const detachResultIds = linkedResults
      .filter((r) => r.actualIn !== null || r._count.corrections > 0)
      .map((r) => r.id);

    if (staleResultIds.length > 0) {
      await tx.attendanceException.deleteMany({
        where: { attendanceResultId: { in: staleResultIds } },
      });
      await tx.attendanceResult.deleteMany({
        where: { id: { in: staleResultIds } },
      });
    }

    if (detachResultIds.length > 0) {
      await tx.attendanceResult.updateMany({
        where: { id: { in: detachResultIds } },
        data: { shiftAssignmentId: null },
      });
    }

    await tx.shiftAssignment.deleteMany({
      where: { id: { in: foundIds } },
    });
  });

  // Compact sequences on affected employee-days
  await resequenceEmployeeDays(
    assignments.map((a) => ({
      employeeId: a.employeeId,
      workDate: a.workDate,
    }))
  );

  // Sync ZKBioTime temporary meal schedule
  await syncZKBioTimeDelete(
    assignments.map((a) => ({
      employeeId: a.employeeId,
      workDate: a.workDate,
      shiftTemplateName: a.shiftTemplate.name,
    }))
  );

  invalidateShiftIntegrityCache();
  return assignments.length;
}

/**
 * Ensures all `ShiftAssignment` records in the database are clean, normalized,
 * duplicate-free, and accurately sequenced for reporting:
 *   1. Removes dead `CANCELLED` rows safely (freeing sequence slots & cleaning stale `ABSENT` results).
 *   2. Normalizes legacy `PENDING_APPROVAL` status to `SCHEDULED`.
 *   3. Deduplicates accidental duplicate same-template shifts on the same `(employeeId, workDate, shiftTemplateId)`
 *      while preserving genuine Double Shifts (e.g. `Morning` + `Afternoon`).
 *   4. Ensures sequences per `(employeeId, workDate)` are contiguous `1, 2, ...` in chronological order.
 */
export async function ensureShiftAssignmentsAccurate(
  force = false
): Promise<void> {
  const now = Date.now();
  if (!force && now - lastIntegrityCheckMs < INTEGRITY_TTL_MS) {
    return;
  }
  if (integrityPromise) {
    return integrityPromise;
  }

  integrityPromise = (async () => {
    try {
      // 1. Purge any CANCELLED shift rows so they never pollute unfiltered queries or block sequence numbers
      const cancelledRows = await prisma.shiftAssignment.findMany({
        where: { status: "CANCELLED" },
        select: { id: true },
      });
      if (cancelledRows.length > 0) {
        await deleteShiftAssignmentsSafely(cancelledRows.map((c) => c.id));
      }

      // 2. Normalize any legacy PENDING_APPROVAL rows to SCHEDULED and ensure ZKBioTime is synced
      const pendingRows = await prisma.shiftAssignment.findMany({
        where: { status: "PENDING_APPROVAL" },
        include: { shiftTemplate: { select: { name: true } } },
      });
      if (pendingRows.length > 0) {
        await prisma.shiftAssignment.updateMany({
          where: { id: { in: pendingRows.map((p) => p.id) } },
          data: { status: "SCHEDULED" },
        });
        await syncZKBioTimeInsert(
          pendingRows.map((p) => ({
            employeeId: p.employeeId,
            workDate: p.workDate,
            shiftTemplateName: p.shiftTemplate.name,
          }))
        );
      }

      // 3. Scan active shifts for same-template duplicates or sequence gaps/misordering
      const allActive = await prisma.shiftAssignment.findMany({
        where: { status: { not: "CANCELLED" } },
        include: {
          shiftTemplate: { select: { id: true, name: true, startTime: true } },
        },
        orderBy: [
          { workDate: "asc" },
          { employeeId: "asc" },
          { sequence: "asc" },
          { createdAt: "asc" },
        ],
      });

      const seenEmpDateTpl = new Set<string>();
      const duplicateIds: string[] = [];
      const byEmpDay = new Map<string, typeof allActive>();

      for (const a of allActive) {
        const dStr = a.workDate.toISOString().slice(0, 10);
        const tplKey = `${a.employeeId}|${dStr}|${a.shiftTemplateId}`;
        if (seenEmpDateTpl.has(tplKey)) {
          duplicateIds.push(a.id);
          continue;
        }
        seenEmpDateTpl.add(tplKey);

        const dayKey = `${a.employeeId}|${dStr}`;
        const list = byEmpDay.get(dayKey) || [];
        list.push(a);
        byEmpDay.set(dayKey, list);
      }

      if (duplicateIds.length > 0) {
        await deleteShiftAssignmentsSafely(duplicateIds);
      }

      // 4. Check for any remaining sequence gaps or non-chronological ordering
      const daysToResequence: Array<{ employeeId: number; workDate: Date }> = [];
      for (const list of byEmpDay.values()) {
        const sorted = [...list].sort((a, b) =>
          a.shiftTemplate.startTime.localeCompare(b.shiftTemplate.startTime)
        );
        const outOfOrder = sorted.some((item, idx) => item.sequence !== idx + 1);
        if (outOfOrder) {
          daysToResequence.push({
            employeeId: list[0].employeeId,
            workDate: list[0].workDate,
          });
        }
      }

      if (daysToResequence.length > 0) {
        await resequenceEmployeeDays(daysToResequence);
      }

      lastIntegrityCheckMs = Date.now();
    } catch (err) {
      console.error("[ShiftIntegrity] Failed to reconcile shift records:", err);
    } finally {
      integrityPromise = null;
    }
  })();

  return integrityPromise;
}
