"use client";

import { Download, FileText, Table } from "lucide-react";

interface ExportButtonsProps {
  data: any[];
  filename: string;
  headers: { label: string; key: string }[];
}

export function ExportButtons({ data, filename, headers }: ExportButtonsProps) {
  const exportToCSV = () => {
    const csvContent = [
      headers.map(h => h.label).join(","),
      ...data.map(row => 
        headers.map(h => {
          const val = row[h.key] || "";
          return `"${String(val).replace(/"/g, '""')}"`;
        }).join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    // For a quick version without heavy libraries, we use window.print() 
    // styled for the specific table, or suggest jspdf if they want a back-end generated one.
    // For now, we'll provide the UI and a print trigger which many hotels use for PDFing.
    window.print();
  };

  return (
    <div className="flex items-center gap-2">
      <button 
        onClick={exportToCSV}
        className="btn-outline btn-sm flex items-center gap-2"
        title="Export to Excel (CSV)"
      >
        <Table className="w-4 h-4 text-emerald-600" />
        <span>Excel</span>
      </button>
      <button 
        onClick={exportToPDF}
        className="btn-outline btn-sm flex items-center gap-2"
        title="Export to PDF (Print)"
      >
        <FileText className="w-4 h-4 text-red-600" />
        <span>PDF</span>
      </button>
    </div>
  );
}
