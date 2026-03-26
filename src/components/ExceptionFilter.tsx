"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Filter, X } from "lucide-react";

export default function ExceptionFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(searchParams.get("status") || "unresolved");

  const handleApply = () => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    
    setOpen(false);
    router.push(`/exceptions?${params.toString()}`);
  };

  const handleClear = () => {
    setStatus("unresolved");
    setOpen(false);
    router.push(`/exceptions`);
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-4 py-2 border rounded-md transition-colors text-sm font-medium shadow-sm ${open || searchParams.has("status") ? 'bg-primary/10 text-primary border-primary/20' : 'bg-white text-gray-700 border-border hover:bg-gray-50'}`}
      >
        <Filter className="w-4 h-4" />
        Filter Status
      </button>

      {open && (
        <div className="absolute top-12 right-0 w-64 bg-white rounded-xl shadow-xl border border-border z-50 p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900">Filter Exceptions</h3>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Status</label>
              <select 
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full text-sm border border-border rounded-md px-3 py-2 focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value="unresolved">Unresolved Only</option>
                <option value="resolved">Resolved Only</option>
                <option value="all">All Exceptions</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                onClick={handleClear}
                className="flex-1 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Clear
              </button>
              <button 
                onClick={handleApply}
                className="flex-1 py-1.5 text-sm bg-primary text-white rounded-md hover:bg-primary/90 font-medium"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
