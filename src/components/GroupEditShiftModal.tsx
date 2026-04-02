"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Edit2, Trash2, Plus, FileText } from "lucide-react";
import type { ShiftAssignment, Employee, ShiftTemplate, Department } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssignmentWithRelations extends ShiftAssignment {
  employee: Employee & { department: Department | null };
  shiftTemplate: ShiftTemplate;
}

interface GroupEditShiftModalProps {
  /** All assignments for this (employee, workDate) group */
  assignments: AssignmentWithRelations[];
  /** When true, all inputs are disabled — used for HOD view-only mode */
  readOnly?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GroupEditShiftModal({ assignments, readOnly = false }: GroupEditShiftModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Local editable state per-sequence row:
  // { id: assignmentId, shiftTemplateId, sequence, action: "keep"|"update"|"delete" }
  type RowState = {
    id: string;
    shiftTemplateId: string;
    sequence: number;
    action: "keep" | "update" | "delete";
  };
  const [rows, setRows] = useState<RowState[]>([]);

  const emp = assignments[0]?.employee;
  const workDate = assignments[0]?.workDate;

  // Load templates on open
  useEffect(() => {
    if (!open) return;
    fetch("/api/shifts")
      .then((r) => r.json())
      .then(setTemplates)
      .catch(() => setError("Failed to load shift templates."));
  }, [open]);

  const handleOpen = () => {
    setOpen(true);
    setError(null);
    // Reset rows from assignments prop
    setRows(
      [...assignments]
        .sort((a, b) => a.sequence - b.sequence)
        .map((a) => ({
          id: a.id,
          shiftTemplateId: a.shiftTemplateId,
          sequence: a.sequence,
          action: "keep",
        }))
    );
  };

  const handleClose = () => {
    if (isPending) return;
    setOpen(false);
  };

  // ── Row helpers ──────────────────────────────────────────────────────────────

  const updateRow = (id: string, patch: Partial<RowState>) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, ...patch, action: patch.action ?? (r.action === "keep" ? "update" : r.action) } : r
      )
    );
  };

  const markDelete = (id: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, action: "delete" } : r)));
  };

  const undoDelete = (id: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, action: "keep" } : r)));
  };

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      try {
        const toDelete = rows.filter((r) => r.action === "delete");
        const toUpdate = rows.filter((r) => r.action === "update");

        // Fire all mutations in parallel
        const ops: Promise<Response>[] = [
          ...toDelete.map((r) =>
            fetch(`/api/shifts/${r.id}`, { method: "DELETE" })
          ),
          ...toUpdate.map((r) =>
            fetch(`/api/shifts/${r.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                shiftTemplateId: r.shiftTemplateId,
                sequence: r.sequence,
              }),
            })
          ),
        ];

        const results = await Promise.all(ops);
        const failed = results.find((r) => !r.ok);
        if (failed) {
          const data = await failed.json().catch(() => ({}));
          setError(data.message || "One or more updates failed.");
          return;
        }

        setOpen(false);
        router.refresh();
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  };

  const activeRows = rows.filter((r) => r.action !== "delete");
  const deletedRows = rows.filter((r) => r.action === "delete");
  const hasChanges = rows.some((r) => r.action !== "keep");

  const formattedDate = workDate
    ? new Date(workDate).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={handleOpen}
        className="font-medium text-accent hover:underline text-xs flex items-center justify-end gap-1 w-full"
      >
        {readOnly ? (
          <FileText className="w-3 h-3" />
        ) : (
          <Edit2 className="w-3 h-3" />
        )}
        {readOnly ? "View" : "Edit"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg z-50 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Edit Shift Assignment</h2>
                {emp && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    <span className="font-medium text-gray-700">{emp.fullName}</span>
                    <span className="mx-1.5 text-gray-300">·</span>
                    <span className="font-mono text-gray-500">{emp.empCode}</span>
                    {emp.department && (
                      <>
                        <span className="mx-1.5 text-gray-300">·</span>
                        <span>{emp.department.name}</span>
                      </>
                    )}
                    <span className="mx-1.5 text-gray-300">·</span>
                    <span>{formattedDate}</span>
                  </p>
                )}
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-3 max-h-[55vh] overflow-y-auto">
              {/* Employee info chip (read-only) */}
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {emp?.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{emp?.fullName}</div>
                  <div className="text-xs text-gray-500 font-mono">{emp?.empCode}</div>
                </div>
                <span className="ml-auto text-[10px] font-semibold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                  {assignments.length > 1 ? `${assignments.length}× Shift` : "Single Shift"}
                </span>
              </div>

              {/* Divider */}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Shift Sequences
              </p>

              {/* Active rows */}
              {activeRows.map((row, idx) => {
                const tpl = templates.find((t) => t.id === row.shiftTemplateId);
                return (
                  <div
                    key={row.id}
                    className={`rounded-xl border px-4 py-3 space-y-2 transition-colors ${
                      row.action === "update"
                        ? "border-amber-300 bg-amber-50/60"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    {/* Row header */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                        Sequence {idx + 1}
                      </span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => markDelete(row.id)}
                          disabled={isPending}
                          className="text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors"
                          title="Remove this sequence"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Shift template selector */}
                    <select
                      value={row.shiftTemplateId}
                      onChange={(e) =>
                        updateRow(row.id, { shiftTemplateId: e.target.value, action: "update" })
                      }
                      disabled={readOnly || isPending || templates.length === 0}
                      className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/40 transition disabled:bg-gray-50 disabled:text-gray-500"
                    >
                      <option value="">
                        {templates.length === 0 ? "Loading…" : "Select shift…"}
                      </option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.startTime}–{t.endTime})
                        </option>
                      ))}
                    </select>

                    {/* Time preview pill */}
                    {tpl && (
                      <div
                        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full w-fit text-white font-medium"
                        style={{ backgroundColor: tpl.color || "#6b7280" }}
                      >
                        <span>⏰</span>
                        <span>
                          {tpl.startTime} – {tpl.endTime}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Pending delete previews */}
              {deletedRows.map((row) => (
                <div
                  key={row.id}
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-sm text-red-500 line-through">
                      {templates.find((t) => t.id === row.shiftTemplateId)?.name ||
                        "Shift"}
                      &nbsp;(Seq {row.sequence})
                    </span>
                  </div>
                  <button
                    onClick={() => undoDelete(row.id)}
                    className="text-xs text-red-500 hover:text-red-700 underline"
                  >
                    Undo
                  </button>
                </div>
              ))}

              {activeRows.length === 0 && deletedRows.length > 0 && (
                <p className="text-xs text-center text-gray-400 py-2">
                  All sequences marked for deletion. Save to confirm.
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="mx-6 mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isPending}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {readOnly ? "Close" : "Cancel"}
              </button>

              {!readOnly && (
                <button
                  onClick={handleSave}
                  disabled={isPending || !hasChanges}
                  className="px-5 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isPending ? "Saving…" : "Save Changes"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
