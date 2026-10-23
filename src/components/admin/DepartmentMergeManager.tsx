"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GitMerge, Loader2, RotateCcw, CheckCircle2, AlertTriangle } from "lucide-react";

interface MergeDept {
  id: number;
  name: string;
  employeeCount: number;
}
interface MergeGroup {
  key: string;
  keeper: MergeDept;
  duplicates: MergeDept[];
}
interface LastMerge {
  id: string;
  createdAt: string;
  details: string | null;
}

export default function DepartmentMergeManager() {
  const router = useRouter();
  const [groups, setGroups] = useState<MergeGroup[]>([]);
  const [lastMerge, setLastMerge] = useState<LastMerge | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/departments/merge", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load");
      setGroups(data.groups ?? []);
      setLastMerge(data.lastMerge ?? null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = (action: "merge" | "undo") => {
    const prompt =
      action === "merge"
        ? `Merge ${groups.reduce((n, g) => n + g.duplicates.length, 0)} duplicate department(s) into ${groups.length} department(s)?\n\nEmployees will be moved in ZKBioTime and the empty duplicates deleted. A backup is kept so this can be undone.`
        : "Undo the last department merge and restore the original departments?";
    if (!confirm(prompt)) return;

    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/departments/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Operation failed");
        setMessage(
          action === "merge"
            ? `✓ Merged ${data.groupsMerged} department group(s): ${data.employeesMoved} employee(s) moved, ${data.departmentsRemoved} duplicate department(s) removed.`
            : `✓ Restored ${data.departmentsRestored} department(s).`
        );
        await load();
        router.refresh();
      } catch (e: any) {
        setError(e.message);
      }
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden" id="department-merge">
      <div className="p-6 border-b border-border bg-gray-50/50 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-primary flex items-center gap-2">
            <GitMerge className="w-5 h-5" /> Merge Duplicate Departments
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Finds departments that are the same but spelled differently (e.g. “IT” / “I.T”, “Kitchen” / “KITCHEN”,
            “F &amp; B” / “Food and Beverages”). The one with the most employees is kept.
          </p>
        </div>
        {lastMerge && (
          <button
            onClick={() => run("undo")}
            disabled={isPending}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            title={lastMerge.details ?? ""}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Undo last merge
          </button>
        )}
      </div>

      <div className="p-6 space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}
        {message && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2.5 text-sm">
            {message}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Analysing departments…
          </div>
        ) : groups.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="w-4 h-4" /> No duplicate departments found.
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-gray-500 border-b border-border">
                <tr>
                  <th className="text-left py-2">Keep</th>
                  <th className="text-left py-2">Merge into it (then delete)</th>
                  <th className="text-right py-2">Employees after</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {groups.map((g) => (
                  <tr key={g.key}>
                    <td className="py-2.5 font-semibold text-gray-900">
                      {g.keeper.name}{" "}
                      <span className="text-xs font-normal text-gray-500">({g.keeper.employeeCount})</span>
                    </td>
                    <td className="py-2.5 text-gray-700">
                      {g.duplicates.map((d) => (
                        <span
                          key={d.id}
                          className="inline-flex items-center mr-1.5 mb-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-xs"
                        >
                          {d.name} ({d.employeeCount})
                        </span>
                      ))}
                    </td>
                    <td className="py-2.5 text-right font-mono">
                      {g.keeper.employeeCount + g.duplicates.reduce((n, d) => n + d.employeeCount, 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              onClick={() => run("merge")}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-60"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />}
              Merge {groups.length} department group(s)
            </button>
          </>
        )}
      </div>
    </div>
  );
}
