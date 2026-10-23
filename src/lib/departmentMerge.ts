import prisma from "@/lib/prisma";

/**
 * Department consolidation for ZKBioTime `public.personnel_department`.
 *
 * Duplicate departments (e.g. "IT" / "I.T", "Housekeeping" / "HOUSEKEEPING",
 * "Food and Beverages" / "F & B") are detected by a normalized name key, so the
 * merge works on any database regardless of department IDs.
 *
 * For each duplicate group the department with the MOST employees is kept (with its
 * current name). Every row in every table that references the other departments is
 * re-pointed to the kept department (foreign keys are discovered at run time), and the
 * now-empty duplicates are deleted. A full backup is written to `workforce.AuditLog`
 * so the merge can be undone.
 */

const MERGE_ACTION = "DEPARTMENT_MERGE";
const UNDO_ACTION = "DEPARTMENT_MERGE_UNDO";
const DEPT_TABLE = `"public"."personnel_department"`;

/** Known abbreviations / spellings that refer to the same department. */
const KEY_ALIASES: Record<string, string> = {
  fandb: "foodandbeverage",
  fb: "foodandbeverage",
  foodandbeverages: "foodandbeverage",
  foodbeverage: "foodandbeverage",
  foodbeverages: "foodandbeverage",
  informationtechnology: "it",
  ict: "it",
  humanresources: "hr",
  humanresource: "hr",
  reservation: "reservations",
  frontdesk: "frontoffice",
  executiveoffices: "executiveoffice",
};

/** Normalizes a department name: case, spaces, dots and "&" vs "and" are ignored. */
export function normalizeDepartmentKey(name: string): string {
  const base = (name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "");
  return KEY_ALIASES[base] ?? base;
}

export interface MergeDept {
  id: number;
  name: string;
  employeeCount: number;
}

export interface MergeGroup {
  key: string;
  keeper: MergeDept;
  duplicates: MergeDept[];
}

/** Returns the duplicate groups that would be merged (no changes are made). */
export async function planDepartmentMerge(): Promise<MergeGroup[]> {
  const rows = await prisma.$queryRawUnsafe<
    { id: number; dept_name: string; emp_count: number }[]
  >(`
    SELECT d.id, d.dept_name,
           (SELECT COUNT(*)::int FROM public.personnel_employee e WHERE e.department_id = d.id) AS emp_count
    FROM public.personnel_department d
  `);

  const byKey = new Map<string, MergeDept[]>();
  for (const r of rows) {
    const key = normalizeDepartmentKey(r.dept_name);
    if (!key) continue;
    const list = byKey.get(key) || [];
    list.push({ id: r.id, name: r.dept_name, employeeCount: r.emp_count });
    byKey.set(key, list);
  }

  const groups: MergeGroup[] = [];
  for (const [key, list] of byKey.entries()) {
    if (list.length < 2) continue;
    // Keeper = most employees; tie-break on the lowest (oldest) id
    const sorted = [...list].sort(
      (a, b) => b.employeeCount - a.employeeCount || a.id - b.id
    );
    groups.push({ key, keeper: sorted[0], duplicates: sorted.slice(1) });
  }

  return groups.sort((a, b) => a.keeper.name.localeCompare(b.keeper.name));
}

// ─── Reference discovery ──────────────────────────────────────────────────────

interface DeptReference {
  schema: string;
  table: string;
  column: string;
  qualified: string; // "schema"."table"
  pkCols: string[];
  uniqueSets: string[][]; // unique indexes that include `column`
}

function qi(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function discoverReferences(tx: Tx): Promise<DeptReference[]> {
  const fks = await tx.$queryRawUnsafe<
    { schema: string; tbl: string; col: string }[]
  >(`
    SELECT DISTINCT n.nspname AS schema, cl.relname AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.personnel_department'::regclass
      AND array_length(c.conkey, 1) = 1
  `);

  const refs: DeptReference[] = [];
  for (const fk of fks) {
    const qualified = `${qi(fk.schema)}.${qi(fk.tbl)}`;
    const indexes = await tx.$queryRawUnsafe<
      { is_pk: boolean; cols: string[] | null }[]
    >(
      `
      SELECT i.indisprimary AS is_pk,
             (SELECT array_agg(a.attname::text ORDER BY k.ord)
                FROM unnest(i.indkey::int2[]) WITH ORDINALITY AS k(attnum, ord)
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum) AS cols
      FROM pg_index i
      WHERE i.indrelid = $1::regclass AND (i.indisunique OR i.indisprimary)
    `,
      qualified
    );

    const pkCols = indexes.find((ix) => ix.is_pk)?.cols ?? [];
    const uniqueSets = indexes
      .map((ix) => ix.cols ?? [])
      .filter((cols) => cols.includes(fk.col));

    refs.push({
      schema: fk.schema,
      table: fk.tbl,
      column: fk.col,
      qualified,
      pkCols,
      uniqueSets,
    });
  }
  return refs;
}

// ─── Backup format ────────────────────────────────────────────────────────────

interface RefBackup {
  schema: string;
  table: string;
  column: string;
  pkCols: string[];
  fromDeptId: number;
  rows: Record<string, unknown>[]; // full rows (as JSON) BEFORE the merge
}

interface MergeBackup {
  version: 1;
  groups: MergeGroup[];
  departments: Record<string, unknown>[]; // full deleted department rows
  references: RefBackup[];
}

export interface MergeResult {
  auditLogId: string;
  groupsMerged: number;
  departmentsRemoved: number;
  employeesMoved: number;
  groups: MergeGroup[];
}

/**
 * Merges all duplicate departments in a single transaction.
 * Returns a summary; throws if anything fails (nothing is changed in that case).
 */
export async function executeDepartmentMerge(
  userId: string
): Promise<MergeResult> {
  const groups = await planDepartmentMerge();
  if (groups.length === 0) {
    throw new Error("No duplicate departments found.");
  }

  const backup: MergeBackup = {
    version: 1,
    groups,
    departments: [],
    references: [],
  };
  let employeesMoved = 0;
  let departmentsRemoved = 0;

  const auditLogId = await prisma.$transaction(
    async (tx) => {
      const refs = await discoverReferences(tx);

      for (const group of groups) {
        const keeperId = group.keeper.id;

        for (const dup of group.duplicates) {
          const dupId = dup.id;

          // Back up the department row itself before anything changes
          const deptRows = await tx.$queryRawUnsafe<{ row: Record<string, unknown> }[]>(
            `SELECT to_jsonb(d) AS row FROM ${DEPT_TABLE} d WHERE d.id = $1`,
            dupId
          );
          if (deptRows.length === 0) continue;
          backup.departments.push(deptRows[0].row);

          for (const ref of refs) {
            const col = qi(ref.column);

            const affected = await tx.$queryRawUnsafe<{ row: Record<string, unknown> }[]>(
              `SELECT to_jsonb(t) AS row FROM ${ref.qualified} t WHERE t.${col} = $1`,
              dupId
            );
            if (affected.length === 0) continue;

            backup.references.push({
              schema: ref.schema,
              table: ref.table,
              column: ref.column,
              pkCols: ref.pkCols,
              fromDeptId: dupId,
              rows: affected.map((a) => a.row),
            });

            // Remove rows that would violate a unique index once re-pointed
            for (const uniq of ref.uniqueSets) {
              const others = uniq.filter((c) => c !== ref.column);
              const sameOthers = others
                .map((c) => `t2.${qi(c)} = t.${qi(c)}`)
                .join(" AND ");
              await tx.$executeRawUnsafe(
                `DELETE FROM ${ref.qualified} t
                 WHERE t.${col} = $1
                   AND EXISTS (
                     SELECT 1 FROM ${ref.qualified} t2
                     WHERE t2.${col} = $2${sameOthers ? ` AND ${sameOthers}` : ""}
                   )`,
                dupId,
                keeperId
              );
            }

            // Self-reference (parent department): never make the keeper its own parent
            if (ref.schema === "public" && ref.table === "personnel_department") {
              await tx.$executeRawUnsafe(
                `UPDATE ${ref.qualified} SET ${col} = NULL WHERE id = $1 AND ${col} = $2`,
                keeperId,
                dupId
              );
            }

            const updated = await tx.$executeRawUnsafe(
              `UPDATE ${ref.qualified} SET ${col} = $1 WHERE ${col} = $2`,
              keeperId,
              dupId
            );

            if (ref.schema === "public" && ref.table === "personnel_employee") {
              employeesMoved += Number(updated) || 0;
            }
          }

          await tx.$executeRawUnsafe(
            `DELETE FROM ${DEPT_TABLE} WHERE id = $1`,
            dupId
          );
          departmentsRemoved += 1;
        }
      }

      // Also clean up any trailing/leading whitespace in remaining department names
      await tx.$executeRawUnsafe(
        `UPDATE ${DEPT_TABLE} SET dept_name = TRIM(dept_name) WHERE dept_name != TRIM(dept_name)`
      );

      const log = await tx.auditLog.create({
        data: {
          userId,
          action: MERGE_ACTION,
          entity: "Department",
          beforeJson: JSON.stringify(backup),
          details: groups
            .map(
              (g) =>
                `${g.duplicates.map((d) => `"${d.name.trim()}"`).join(", ")} → "${g.keeper.name.trim()}"`
            )
            .join("; "),
        },
      });
      return log.id;
    },
    { timeout: 120_000, maxWait: 20_000 }
  );

  return {
    auditLogId,
    groupsMerged: groups.length,
    departmentsRemoved,
    employeesMoved,
    groups,
  };
}

/** Returns the most recent merge that has not been undone (if any). */
export async function getLastUndoableMerge() {
  const merges = await prisma.auditLog.findMany({
    where: { action: MERGE_ACTION },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, createdAt: true, details: true, userId: true },
  });
  if (merges.length === 0) return null;

  const undone = await prisma.auditLog.findMany({
    where: { action: UNDO_ACTION, entityId: { in: merges.map((m) => m.id) } },
    select: { entityId: true },
  });
  const undoneIds = new Set(undone.map((u) => u.entityId));
  return merges.find((m) => !undoneIds.has(m.id)) ?? null;
}

/**
 * Restores the departments and every re-pointed row from the most recent merge backup.
 */
export async function undoLastDepartmentMerge(userId: string) {
  const last = await getLastUndoableMerge();
  if (!last) throw new Error("There is no department merge to undo.");

  const log = await prisma.auditLog.findUnique({ where: { id: last.id } });
  if (!log?.beforeJson) throw new Error("Merge backup data is missing.");
  const backup = JSON.parse(log.beforeJson) as MergeBackup;

  let rowsRestored = 0;

  await prisma.$transaction(
    async (tx) => {
      // 1. Re-create the deleted departments with their original IDs and data
      for (const dept of backup.departments) {
        await tx.$executeRawUnsafe(
          `INSERT INTO ${DEPT_TABLE}
           SELECT * FROM jsonb_populate_record(NULL::public.personnel_department, $1::jsonb)
           ON CONFLICT (id) DO NOTHING`,
          JSON.stringify(dept)
        );
      }

      // 2. Point every backed-up row back at its original department
      for (const ref of backup.references) {
        const qualified = `${qi(ref.schema)}.${qi(ref.table)}`;
        const col = qi(ref.column);

        for (const row of ref.rows) {
          let updated = 0;
          if (ref.pkCols.length > 0) {
            const where = ref.pkCols
              .map((c, i) => `t.${qi(c)}::text = $${i + 2}`)
              .join(" AND ");
            updated = Number(
              await tx.$executeRawUnsafe(
                `UPDATE ${qualified} t SET ${col} = $1 WHERE ${where}`,
                ref.fromDeptId,
                ...ref.pkCols.map((c) => String(row[c]))
              )
            );
          }

          // Row was removed during the merge (unique conflict) → re-insert it
          if (updated === 0) {
            await tx.$executeRawUnsafe(
              `INSERT INTO ${qualified}
               SELECT * FROM jsonb_populate_record(NULL::${qualified}, $1::jsonb)
               ON CONFLICT DO NOTHING`,
              JSON.stringify(row)
            );
          }
          rowsRestored += 1;
        }
      }

      await tx.auditLog.create({
        data: {
          userId,
          action: UNDO_ACTION,
          entity: "Department",
          entityId: last.id,
          details: `Undid department merge from ${last.createdAt.toISOString()}`,
        },
      });
    },
    { timeout: 120_000, maxWait: 20_000 }
  );

  return {
    departmentsRestored: backup.departments.length,
    rowsRestored,
  };
}
