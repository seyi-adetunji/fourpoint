"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface Department {
  id: number;
  name: string;
}

export default function ManageDepartments({ initialDepartments }: { initialDepartments: Department[] }) {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "" });

  const handleCreate = () => {
    setIsCreating(true);
    setError(null);
    setForm({ name: "" });
  };

  const handleCancel = () => {
    setIsCreating(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to create department");
      }

      const saved = await res.json();
      setDepartments((prev) => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
      setIsCreating(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this department? Employees assigned to it will retain the text value.")) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/departments/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete department");
      }

      setDepartments((prev) => prev.filter((d) => d.id !== id));
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 pt-8">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-semibold text-primary">Departments</h2>
          <p className="text-sm text-gray-500 mt-1">Manage selectable departments for employees.</p>
        </div>
        {!isCreating && (
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm">
          {error}
        </div>
      )}

      {isCreating && (
        <div className="p-4 bg-gray-50 border border-border rounded-lg space-y-4 mb-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Department Name</label>
            <input
              type="text"
              placeholder="e.g. Finance"
              value={form.name}
              onChange={(e) => setForm({ name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={handleCancel}
              disabled={loading}
              className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !form.name.trim()}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden border border-border rounded-lg">
        <table className="min-w-full divide-y divide-border">
          <tbody className="bg-white divide-y divide-border">
            {departments.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-gray-500">
                  No departments configured.
                </td>
              </tr>
            ) : (
              departments.map((dept) => (
                <tr key={dept.id} className="hover:bg-gray-50/50 transition-colors flex justify-between items-center px-4 py-3">
                  <td className="whitespace-nowrap text-sm font-medium text-gray-900">
                    {dept.name}
                  </td>
                  <td className="whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleDelete(dept.id)}
                      disabled={loading}
                      className="text-red-600 hover:text-red-900 disabled:opacity-50 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
