"use client";

import { useState } from "react";
import { format } from "date-fns";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ManualAdjustmentModal } from "@/components/modals/ManualAdjustmentModal";
import { ExportButtons } from "@/components/ExportButtons";

interface CorrectionsClientProps {
  initialCorrections: any[];
  employees: any[];
}

export function CorrectionsClient({ initialCorrections, employees }: CorrectionsClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const exportData = initialCorrections.map(c => ({
    fullName: c.employee?.fullName,
    department: c.employee?.department?.name || "—",
    date: format(new Date(c.workDate), "yyyy-MM-dd"),
    type: c.type,
    time: format(new Date(c.correctedTime), "HH:mm:ss"),
    status: c.status
  }));

  const exportHeaders = [
    { label: "Employee", key: "fullName" },
    { label: "Department", key: "department" },
    { label: "Date", key: "date" },
    { label: "Type", key: "type" },
    { label: "Time", key: "time" },
    { label: "Status", key: "status" },
  ];

  return (
    <>
      <div className="page-header justify-between">
        <div>
          <h1 className="page-title">Attendance Corrections</h1>
          <p className="page-subtitle">Manage manual punch adjustments and corrections</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons data={exportData} filename="attendance_corrections" headers={exportHeaders} />
          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn-primary"
          >
            New Adjustment
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-gray-50/30">
              <tr>
                <th className="px-5 py-3.5 text-left font-semibold">Employee</th>
                <th className="px-5 py-3.5 text-left font-semibold">Department</th>
                <th className="px-5 py-3.5 text-left font-semibold">Work Date</th>
                <th className="px-5 py-3.5 text-left font-semibold">Type</th>
                <th className="px-5 py-3.5 text-left font-semibold">Corrected Time</th>
                <th className="px-5 py-3.5 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {initialCorrections.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">No corrections found.</td></tr>
              ) : initialCorrections.map(cor => (
                <tr key={cor.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{cor.employee.fullName}</td>
                  <td className="px-5 py-3.5 text-gray-600">{cor.employee.department?.name || "—"}</td>
                  <td className="px-5 py-3.5 text-gray-600">{format(new Date(cor.workDate), "MMM dd, yyyy")}</td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${cor.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                      {cor.type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs font-semibold">{format(new Date(cor.correctedTime), "HH:mm:ss")}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={cor.status} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ManualAdjustmentModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        employees={employees}
      />
    </>
  );
}
