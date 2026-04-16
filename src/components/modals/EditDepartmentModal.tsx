"use client";

import { useState } from "react";
import { toast } from "sonner";
import { X, User, Building2 } from "lucide-react";

interface EditDepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  department: {
    id: number;
    name: string;
    deptCode: string;
    deptManagerId: number | null;
  };
  employees: { id: number; fullName: string; empCode: string }[];
}

export function EditDepartmentModal({ isOpen, onClose, department, employees }: EditDepartmentModalProps) {
  const [loading, setLoading] = useState(false);
  const [managerId, setManagerId] = useState<string>(department.deptManagerId?.toString() || "");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/departments/${department.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deptManagerId: managerId ? parseInt(managerId) : null }),
      });

      if (!response.ok) throw new Error("Failed to update department");

      toast.success("Department manager updated successfully");
      onClose();
      window.location.reload();
    } catch (error) {
      toast.error("Error updating department");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-primary">Edit Department</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 mb-2">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Department</p>
            <p className="font-semibold text-gray-900">{department.name}</p>
            <p className="text-xs font-mono text-gray-500">{department.deptCode}</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Head of Department (HOD)
            </label>
            <select 
              className="input w-full"
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
            >
              <option value="">No Manager Assigned</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.empCode})</option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground italic">
              Assigning an HOD allows them to view team reports and manage shifts for this department.
            </p>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="btn-secondary w-full"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? "Saving..." : "Update Department"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
