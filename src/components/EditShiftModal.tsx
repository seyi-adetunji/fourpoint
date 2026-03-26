"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Edit2, Trash2 } from "lucide-react";
import type { ShiftAssignment, Employee, ShiftTemplate } from "@prisma/client";

interface AssignmentWithRelations extends ShiftAssignment {
  employee: Employee;
  shiftTemplate: ShiftTemplate;
}

export default function EditShiftModal({ assignment }: { assignment: AssignmentWithRelations }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);

  const [form, setForm] = useState({
    shiftTemplateId: assignment.shiftTemplateId,
    sequence: assignment.sequence.toString(),
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/shifts")
      .then((r) => r.json())
      .then((data) => setTemplates(data))
      .catch(() => setError("Failed to load shift templates."));
  }, [open]);

  const handleOpen = () => {
    setOpen(true);
    setError(null);
    setForm({
      shiftTemplateId: assignment.shiftTemplateId,
      sequence: assignment.sequence.toString(),
    });
  };

  const handleClose = () => {
    if (isPending || isDeleting) return;
    setOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.shiftTemplateId) {
      setError("Shift type is required.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/shifts/${assignment.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shiftTemplateId: form.shiftTemplateId,
            sequence: parseInt(form.sequence),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.message || "Failed to update shift.");
          return;
        }

        setOpen(false);
        router.refresh();
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this shift assignment?")) return;
    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/shifts/${assignment.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete shift.");
      }

      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedTemplate = templates.find((t) => t.id === form.shiftTemplateId);

  return (
    <>
      <button 
        onClick={handleOpen}
        className="font-medium text-accent hover:underline text-xs flex items-center justify-end gap-1 w-full"
      >
        <Edit2 className="w-3 h-3" /> Edit
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-50 overflow-hidden text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Edit Shift Assignment</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {assignment.employee.name} — {new Date(assignment.date).toDateString()}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Shift Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.shiftTemplateId}
                  onChange={(e) => setForm((f) => ({ ...f, shiftTemplateId: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                  disabled={isPending || templates.length === 0}
                >
                  <option value="">
                    {templates.length === 0 ? "Loading shifts…" : "Select shift…"}
                  </option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.startTime}–{t.endTime})
                    </option>
                  ))}
                </select>
                {selectedTemplate && (
                  <p className="text-xs text-gray-500">
                    ⏰ {selectedTemplate.startTime} – {selectedTemplate.endTime}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Sequence <span className="text-xs text-gray-400 font-normal">(1 = first shift, 2 = double shift)</span>
                </label>
                <div className="flex gap-3">
                  {["1", "2"].map((seq) => (
                    <label key={seq} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="sequence"
                        value={seq}
                        checked={form.sequence === seq}
                        onChange={() => setForm((f) => ({ ...f, sequence: seq }))}
                        disabled={isPending}
                        className="accent-primary"
                      />
                      <span className="text-sm text-gray-700">Sequence {seq}</span>
                    </label>
                  ))}
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isPending || isDeleting}
                  className="text-sm font-medium text-red-600 hover:text-red-700 flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete
                </button>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isPending || isDeleting}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || isDeleting}
                    className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2"
                  >
                    {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isPending ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
