"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function LeaveRequestForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    type: "ANNUAL",
    startDate: "",
    endDate: "",
    reason: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        throw new Error(await res.text() || "Failed to submit request");
      }

      setSuccess(true);
      setFormData({ type: "ANNUAL", startDate: "", endDate: "", reason: "" });
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded">{error}</div>}
      {success && <div className="p-3 bg-green-50 text-green-700 text-sm rounded">Leave request submitted successfully!</div>}

      <div className="space-y-2">
        <label className="text-sm font-medium">Leave Type</label>
        <select 
          className="w-full p-2 border rounded-md"
          value={formData.type}
          onChange={e => setFormData({ ...formData, type: e.target.value })}
        >
          <option value="ANNUAL">Annual Leave</option>
          <option value="SICK">Sick Leave</option>
          <option value="UNPAID">Unpaid Leave</option>
          <option value="MATERNITY">Maternity/Paternity</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Start Date</label>
          <input 
            type="date" 
            required
            className="w-full p-2 border rounded-md"
            value={formData.startDate}
            onChange={e => setFormData({ ...formData, startDate: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">End Date</label>
          <input 
            type="date" 
            required
            className="w-full p-2 border rounded-md"
            value={formData.endDate}
            onChange={e => setFormData({ ...formData, endDate: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Reason (Optional)</label>
        <textarea 
          rows={3}
          className="w-full p-2 border rounded-md"
          value={formData.reason}
          onChange={e => setFormData({ ...formData, reason: e.target.value })}
          placeholder="Briefly describe the reason..."
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 flex items-center justify-center min-w-[120px]"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Request"}
      </button>
    </form>
  );
}
