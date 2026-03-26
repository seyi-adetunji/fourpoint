"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function CorrectionRequestForm({ recentResults }: { recentResults: any[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    attendanceResultId: "",
    reason: "",
    proposedTimeIn: "",
    proposedTimeOut: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch("/api/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        throw new Error(await res.text() || "Failed to submit correction");
      }

      setSuccess(true);
      setFormData({ attendanceResultId: "", reason: "", proposedTimeIn: "", proposedTimeOut: "" });
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
      {success && <div className="p-3 bg-green-50 text-green-700 text-sm rounded">Correction request submitted successfully!</div>}

      <div className="space-y-2">
        <label className="text-sm font-medium">Select Attendance Record</label>
        <select 
          required
          className="w-full p-2 border rounded-md text-sm"
          value={formData.attendanceResultId}
          onChange={e => setFormData({ ...formData, attendanceResultId: e.target.value })}
        >
          <option value="">-- Choose Record --</option>
          {recentResults.map(r => (
            <option key={r.id} value={r.id}>
              {new Date(r.date).toLocaleDateString()} - {r.status}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Proposed Clock In</label>
          <input 
            type="datetime-local" 
            className="w-full p-2 border rounded-md text-sm"
            value={formData.proposedTimeIn}
            onChange={e => setFormData({ ...formData, proposedTimeIn: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Proposed Clock Out</label>
          <input 
            type="datetime-local" 
            className="w-full p-2 border rounded-md text-sm"
            value={formData.proposedTimeOut}
            onChange={e => setFormData({ ...formData, proposedTimeOut: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Reason for Correction</label>
        <textarea 
          required
          rows={3}
          className="w-full p-2 border rounded-md text-sm"
          value={formData.reason}
          onChange={e => setFormData({ ...formData, reason: e.target.value })}
          placeholder="I forgot to clock out..."
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
