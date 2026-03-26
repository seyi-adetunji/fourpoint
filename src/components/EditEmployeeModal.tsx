"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Save, Trash2, Edit2 } from "lucide-react";

interface Employee {
  id: string;
  name: string;
  department: string | null;
}

export default function EditEmployeeModal({ employee }: { employee: Employee }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  import("react").then((React) => {
    React.useEffect(() => {
      if (!open) return;
      fetch("/api/departments")
        .then((res) => res.json())
        .then((data) => setDepartments(data))
        .catch(console.error);
    }, [open]);
  });

  const [form, setForm] = useState({
    name: employee.name,
    department: employee.department || "",
  });

  const handleOpen = () => {
    setOpen(true);
    setForm({
      name: employee.name,
      department: employee.department || "",
    });
    setError(null);
  };

  const handleClose = () => {
    if (loading || deleting) return;
    setOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          department: form.department || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to update employee");
      }

      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this employee? This action cannot be undone.")) return;
    
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to delete employee");
      }

      setOpen(false);
      router.push("/employees");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <button 
        onClick={handleOpen}
        className="w-full mt-6 py-2 px-4 border border-border rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
      >
        <Edit2 className="w-4 h-4" />
        Edit Profile
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <div
            className="relative bg-white rounded-xl shadow-xl w-full max-w-md z-50 overflow-hidden text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gray-50/50">
              <h2 className="text-lg font-semibold text-gray-900">Edit Employee</h2>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
                disabled={loading || deleting}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  disabled={loading || deleting}
                  className="w-full px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Department</label>
                <select
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  disabled={loading || deleting}
                  className="w-full px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                >
                  <option value="">Unassigned</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.name}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-between items-center pt-4">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading || deleting}
                  className="text-sm font-medium text-red-600 hover:text-red-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={loading || deleting}
                    className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || deleting}
                    className="flex flex-row items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save
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
