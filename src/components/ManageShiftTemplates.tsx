"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, Save, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

// The shape matches prisma.shiftTemplate
interface ShiftTemplate {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  graceLate: number;
  graceEarly: number;
}

export default function ManageShiftTemplates({
  initialTemplates,
}: {
  initialTemplates: ShiftTemplate[];
}) {
  const router = useRouter();
  const [templates, setTemplates] = useState<ShiftTemplate[]>(initialTemplates);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    code: "",
    name: "",
    startTime: "",
    endTime: "",
    graceLate: 15,
    graceEarly: 15,
  });

  const handleEdit = (template: ShiftTemplate) => {
    setIsEditing(template.id);
    setIsCreating(false);
    setError(null);
    setForm({
      code: template.code,
      name: template.name,
      startTime: template.startTime,
      endTime: template.endTime,
      graceLate: template.graceLate,
      graceEarly: template.graceEarly,
    });
  };

  const handleCreate = () => {
    setIsCreating(true);
    setIsEditing(null);
    setError(null);
    setForm({
      code: "",
      name: "",
      startTime: "",
      endTime: "",
      graceLate: 15,
      graceEarly: 15,
    });
  };

  const handleCancel = () => {
    setIsEditing(null);
    setIsCreating(false);
    setError(null);
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    const url = isEditing
      ? `/api/settings/shift-templates/${isEditing}`
      : "/api/settings/shift-templates";
    const method = isEditing ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to save template");
      }

      const saved = await res.json();
      
      if (isEditing) {
        setTemplates((prev) => prev.map((t) => (t.id === isEditing ? saved : t)));
      } else {
        setTemplates((prev) => [...prev, saved].sort((a, b) => a.code.localeCompare(b.code)));
      }
      
      setIsEditing(null);
      setIsCreating(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this shift template?")) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/settings/shift-templates/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to delete template");
      }

      setTemplates((prev) => prev.filter((t) => t.id !== id));
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {!isCreating && !isEditing && (
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm">
          {error}
        </div>
      )}

      {(isCreating || isEditing) && (
        <div className="p-4 bg-gray-50 border border-border rounded-lg space-y-4">
          <h3 className="font-semibold text-gray-900">
            {isCreating ? "Create New Template" : "Edit Template"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Code</label>
              <input
                type="text"
                placeholder="e.g. A, B, NIGHT"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Name</label>
              <input
                type="text"
                placeholder="e.g. Morning Shift"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Start Time (HH:MM)</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">End Time (HH:MM)</label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Grace Late (mins)</label>
              <input
                type="number"
                value={form.graceLate}
                onChange={(e) => setForm({ ...form, graceLate: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Grace Early Leave (mins)</label>
              <input
                type="number"
                value={form.graceEarly}
                onChange={(e) => setForm({ ...form, graceEarly: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
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
              disabled={loading}
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
          <thead className="bg-gray-50/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timing</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grace</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-border">
            {templates.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                  No shift templates found.
                </td>
              </tr>
            ) : (
              templates.map((template) => (
                <tr key={template.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {template.code}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {template.name}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {template.startTime} - {template.endTime}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    L: {template.graceLate}m / E: {template.graceEarly}m
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(template)}
                      disabled={loading}
                      className="text-primary hover:text-primary/80 mr-3 disabled:opacity-50"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      disabled={loading}
                      className="text-red-600 hover:text-red-900 disabled:opacity-50"
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
