"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, CalendarIcon, Loader2, CheckCircle2 } from "lucide-react";

interface Employee {
  id: string;
  empCode: string;
  fullName: string;
  department?: { name: string } | null;
}

interface ShiftTemplate {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
}

interface AssignShiftModalProps {
  employees: Employee[];
}

export default function AssignShiftModal({ employees }: AssignShiftModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    employeeId: "",
    shiftTemplateId: "",
    date: "",
    sequence: "1",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load shift templates when modal opens
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
    setSuccess(false);
    setForm({ employeeId: "", shiftTemplateId: "", date: "", sequence: "1" });
  };

  const handleClose = () => {
    if (isPending) return;
    setOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.employeeId || !form.shiftTemplateId || !form.date) {
      setError("All fields are required.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId: form.employeeId,
            shiftTemplateId: form.shiftTemplateId,
            date: form.date,
            sequence: parseInt(form.sequence),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.message || "Failed to assign shift.");
          return;
        }

        setSuccess(true);
        setTimeout(() => {
          setOpen(false);
          router.refresh(); // Refresh the server component to show the new assignment
        }, 1200);
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  };

  const selectedTemplate = templates.find((t) => t.id === form.shiftTemplateId);

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium shadow-sm"
      >
        <CalendarIcon className="w-4 h-4" />
        Assign Shift
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={handleClose}
        >
          {/* Modal Panel */}
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-50 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Assign Shift</h2>
                <p className="text-xs text-gray-500 mt-0.5">Schedule an employee to a shift</p>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {/* Employee */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Employee <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.employeeId}
                  onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                  disabled={isPending}
                >
                  <option value="">Select employee…</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.empCode}){emp.department ? ` — ${emp.department.name}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Shift Template */}
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

              {/* Date */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                  disabled={isPending}
                />
              </div>

              {/* Sequence */}
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

              {/* Error */}
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Success */}
              {success && (
                <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Shift assigned successfully!
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || success}
                  className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isPending ? "Assigning…" : "Assign Shift"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
