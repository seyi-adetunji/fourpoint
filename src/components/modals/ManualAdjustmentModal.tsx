"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { X, Clock, Calendar, User, FileText } from "lucide-react";

interface ManualAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: { id: number; fullName: string; empCode: string }[];
}

export function ManualAdjustmentModal({ isOpen, onClose, employees }: ManualAdjustmentModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: "",
    workDate: format(new Date(), "yyyy-MM-dd"),
    type: "IN",
    correctedTime: format(new Date(), "HH:mm"),
    reason: ""
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/attendance/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to submit adjustment");

      toast.success("Manual adjustment submitted successfully");
      onClose();
      window.location.reload();
    } catch (error) {
      toast.error("Error submitting adjustment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-gray-50/50">
          <h2 className="text-lg font-bold text-primary">Manual Punch Adjustment</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Employee
            </label>
            <select 
              required
              className="input w-full"
              value={formData.employeeId}
              onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
            >
              <option value="">Select Employee</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.empCode})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Date
              </label>
              <input 
                type="date"
                required
                className="input w-full"
                value={formData.workDate}
                onChange={(e) => setFormData({ ...formData, workDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Punch Type
              </label>
              <select 
                className="input w-full"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="IN">Clock In</option>
                <option value="OUT">Clock Out</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Corrected Time
            </label>
            <input 
              type="time"
              required
              className="input w-full"
              value={formData.correctedTime}
              onChange={(e) => setFormData({ ...formData, correctedTime: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Reason
            </label>
            <textarea 
              required
              placeholder="e.g. Device failure, forgotten card..."
              className="input w-full min-h-[80px] py-3 resizable-none"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            />
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
              {loading ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
