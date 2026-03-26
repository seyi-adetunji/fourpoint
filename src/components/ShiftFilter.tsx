"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Filter, X } from "lucide-react";

export default function ShiftFilter({ employees }: { employees: { id: string; name: string }[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState(searchParams.get("employee") || "");
  const [dateStr, setDateStr] = useState(searchParams.get("date") || "");

  const handleApply = () => {
    const params = new URLSearchParams();
    if (employeeId) params.set("employee", employeeId);
    if (dateStr) params.set("date", dateStr);
    
    setOpen(false);
    router.push(`/shifts?${params.toString()}`);
  };

  const handleClear = () => {
    setEmployeeId("");
    setDateStr("");
    setOpen(false);
    router.push(`/shifts`);
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-4 py-2 border rounded-md transition-colors text-sm font-medium shadow-sm ${open || searchParams.has("employee") || searchParams.has("date") ? 'bg-primary/10 text-primary border-primary/20' : 'bg-white text-gray-700 border-border hover:bg-gray-50'}`}
      >
        <Filter className="w-4 h-4" />
        Filter
      </button>

      {open && (
        <div className="absolute top-12 left-0 sm:right-0 sm:left-auto w-72 bg-white rounded-xl shadow-xl border border-border z-50 p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900">Filter Shifts</h3>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Employee</label>
              <select 
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full text-sm border border-border rounded-md px-3 py-2 focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value="">All Employees</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Date</label>
              <input 
                type="date" 
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full text-sm border border-border rounded-md px-3 py-2 focus:ring-1 focus:ring-primary focus:outline-none"
              />
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
