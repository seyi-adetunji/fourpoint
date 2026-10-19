"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Trash2,
  Table,
  FileText,
  Users,
  Calendar,
  Loader2,
  CheckSquare,
  Square,
  Search,
} from "lucide-react";

export interface ShiftListRow {
  id: string;
  workDate: string;
  createdAt: string;
  status: string;
  sequence: number;
  employeeName: string;
  empCode: string;
  departmentId: number | null;
  department: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  color: string;
  createdByName: string | null;
  createdByRole: string | null;
}

export interface DepartmentGroup {
  departmentId: number | null;
  departmentName: string;
  deptCode: string;
  rows: ShiftListRow[];
}

interface ShiftListClientProps {
  departments: { id: number; name: string; deptCode: string }[];
  rows: ShiftListRow[];
  canDelete: boolean;
  initialSelectedDeptId?: string;
}

export function ShiftListClient({
  departments,
  rows,
  canDelete,
  initialSelectedDeptId,
}: ShiftListClientProps) {
  const router = useRouter();
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(() => {
    if (initialSelectedDeptId) return new Set([initialSelectedDeptId]);
    return new Set();
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deptSearch, setDeptSearch] = useState("");

  // Group rows by department
  const departmentGroups: DepartmentGroup[] = useMemo(() => {
    const map = new Map<string, DepartmentGroup>();

    // Initialize with all known departments so user can see every department
    for (const d of departments) {
      const key = String(d.id);
      map.set(key, {
        departmentId: d.id,
        departmentName: d.name,
        deptCode: d.deptCode,
        rows: [],
      });
    }

    for (const r of rows) {
      const key = r.departmentId != null ? String(r.departmentId) : "UNASSIGNED";
      if (!map.has(key)) {
        map.set(key, {
          departmentId: r.departmentId,
          departmentName: r.department || "Unassigned Department",
          deptCode: "—",
          rows: [],
        });
      }
      map.get(key)!.rows.push(r);
    }

    const allGroups = Array.from(map.values());
    // Filter by department search if typed, and sort departments with shifts first (then alphabetically)
    return allGroups
      .filter((g) => {
        if (!deptSearch.trim()) return g.rows.length > 0 || departments.length <= 30;
        return g.departmentName.toLowerCase().includes(deptSearch.toLowerCase());
      })
      .sort((a, b) => {
        if (b.rows.length !== a.rows.length) return b.rows.length - a.rows.length;
        return a.departmentName.localeCompare(b.departmentName);
      });
  }, [departments, rows, deptSearch]);

  const toggleDept = (key: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    const keys = departmentGroups.filter((g) => g.rows.length > 0).map((g) => String(g.departmentId ?? "UNASSIGNED"));
    setExpandedDepts(new Set(keys));
  };

  const collapseAll = () => {
    setExpandedDepts(new Set());
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllInDept = (deptRows: ShiftListRow[]) => {
    const ids = deptRows.map((r) => r.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleDeleteIds = async (ids: string[], label: string) => {
    if (ids.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${label}? This will also remove it from the calendar and ZKBioTime.`)) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/shifts/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentIds: ids }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to delete shifts");
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Failed to delete shifts");
    } finally {
      setDeleting(false);
    }
  };

  // Export specific rows to Excel (CSV with UTF-8 BOM for Excel compatibility)
  const exportRowsToExcel = (targetRows: ShiftListRow[], filenamePrefix: string) => {
    if (targetRows.length === 0) {
      alert("No shifts to export for this selection.");
      return;
    }
    const headers = [
      "Work Date",
      "Employee Name",
      "Staff ID",
      "Department",
      "Shift",
      "Period",
      "Time",
      "Status",
      "Created By",
      "Creator Role",
      "Created On",
    ];
    const csvRows = targetRows.map((r) => [
      format(new Date(r.workDate), "yyyy-MM-dd"),
      r.employeeName,
      r.empCode,
      r.department,
      r.shiftName,
      r.startTime < "12:00" ? "AM (Morning)" : "PM (Afternoon)",
      `${r.startTime} - ${r.endTime}`,
      r.status,
      r.createdByName ?? "System / Admin",
      r.createdByRole ? r.createdByRole.replace(/_/g, " ") : "—",
      format(new Date(r.createdAt), "yyyy-MM-dd HH:mm"),
    ]);

    const csvContent =
      "\uFEFF" +
      [
        headers.map((h) => `"${h}"`).join(","),
        ...csvRows.map((row) =>
          row.map((val) => `"${String(val ?? "").replace(/"/g, '""')}"`).join(",")
        ),
      ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const safeName = filenamePrefix.replace(/[^a-zA-Z0-9_-]/g, "_");
    link.setAttribute("href", url);
    link.setAttribute("download", `${safeName}_${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export specific rows to a clean printable PDF document
  const exportRowsToPDF = (targetRows: ShiftListRow[], title: string) => {
    if (targetRows.length === 0) {
      alert("No shifts to export to PDF for this selection.");
      return;
    }
    const printWin = window.open("", "_blank", "width=1050,height=800");
    if (!printWin) {
      window.print();
      return;
    }

    const rowsHtml = targetRows
      .map(
        (r, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${format(new Date(r.workDate), "dd MMM yyyy")}</td>
          <td><strong>${r.employeeName}</strong></td>
          <td>${r.empCode}</td>
          <td>${r.department}</td>
          <td>${r.shiftName} (${r.startTime < "12:00" ? "AM" : "PM"})</td>
          <td>${r.startTime} – ${r.endTime}</td>
          <td>${r.status}</td>
          <td>${r.createdByName ?? "Admin"}${r.createdByRole ? ` (${r.createdByRole.replace(/_/g, " ")})` : ""}</td>
        </tr>`
      )
      .join("");

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} - Shift Schedule Report</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; margin: 24px; color: #111827; }
            .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1e293b; padding-bottom: 12px; margin-bottom: 16px; }
            h1 { margin: 0; font-size: 20px; color: #0f172a; }
            .subtitle { margin: 4px 0 0; font-size: 12px; color: #475569; }
            .meta { text-align: right; font-size: 12px; color: #475569; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
            th { background-color: #f1f5f9; font-weight: 700; text-transform: uppercase; font-size: 10px; color: #334155; }
            tr:nth-child(even) { background-color: #f8fafc; }
            @media print {
              body { margin: 10px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>${title}</h1>
              <p class="subtitle">WorkforceOps Hotel Shift Register</p>
            </div>
            <div class="meta">
              <div><strong>Generated:</strong> ${format(new Date(), "dd MMM yyyy, HH:mm")}</div>
              <div><strong>Total Shifts:</strong> ${targetRows.length}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Work Date</th>
                <th>Employee</th>
                <th>Staff ID</th>
                <th>Department</th>
                <th>Shift</th>
                <th>Time</th>
                <th>Status</th>
                <th>Created By</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <div className="space-y-4 p-4">
      {/* Top Action Bar: Department quick search, Expand/Collapse, Global Export & Bulk Delete */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/80 border border-border rounded-xl p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={deptSearch}
              onChange={(e) => setDeptSearch(e.target.value)}
              placeholder="Filter department name..."
              className="input pl-9 py-1.5 text-xs w-[210px]"
            />
          </div>
          <button
            type="button"
            onClick={expandAll}
            className="btn-secondary btn-sm text-xs"
          >
            Expand All Departments
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="btn-secondary btn-sm text-xs"
          >
            Collapse All
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canDelete && selectedIds.size > 0 && (
            <button
              type="button"
              disabled={deleting}
              onClick={() =>
                handleDeleteIds(
                  Array.from(selectedIds),
                  `${selectedIds.size} selected shift(s)`
                )
              }
              className="btn-sm bg-red-600 hover:bg-red-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              {deleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              Delete Selected ({selectedIds.size})
            </button>
          )}

          <button
            type="button"
            onClick={() => exportRowsToExcel(rows, "All_Departments_Shifts")}
            className="btn-outline btn-sm flex items-center gap-1.5 text-xs"
            title="Export all filtered shifts to Excel (CSV)"
          >
            <Table className="w-4 h-4 text-emerald-600" />
            <span>Export All Excel</span>
          </button>
          <button
            type="button"
            onClick={() => exportRowsToPDF(rows, "All Departments — Shift Schedule")}
            className="btn-outline btn-sm flex items-center gap-1.5 text-xs"
            title="Export all filtered shifts to PDF"
          >
            <FileText className="w-4 h-4 text-red-600" />
            <span>Export All PDF</span>
          </button>
        </div>
      </div>

      {/* Department Accordion List */}
      {departmentGroups.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No departments or shifts found matching your criteria.
        </div>
      ) : (
        <div className="space-y-3">
          {departmentGroups.map((group) => {
            const key = String(group.departmentId ?? "UNASSIGNED");
            const isExpanded = expandedDepts.has(key);
            const totalShifts = group.rows.length;
            const uniqueStaff = new Set(group.rows.map((r) => r.empCode)).size;
            const morningCount = group.rows.filter((r) => r.startTime < "12:00").length;
            const afternoonCount = totalShifts - morningCount;
            const allDeptSelected =
              totalShifts > 0 && group.rows.every((r) => selectedIds.has(r.id));

            return (
              <div
                key={key}
                className="border border-border rounded-xl bg-white overflow-hidden shadow-xs transition-all"
              >
                {/* Clickable Department Header */}
                <div
                  onClick={() => toggleDept(key)}
                  className={`w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 cursor-pointer select-none transition-colors ${
                    isExpanded
                      ? "bg-primary/5 border-b border-border"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" />
                        <span className="font-bold text-gray-900 text-sm sm:text-base">
                          {group.departmentName}
                        </span>
                        {group.deptCode && group.deptCode !== "—" && (
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                            {group.deptCode}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Click to {isExpanded ? "hide" : "view"} all shifts in{" "}
                        {group.departmentName}
                      </p>
                    </div>
                  </div>

                  {/* Department Badges & Per-Department Export Buttons */}
                  <div
                    className="flex items-center gap-2 flex-wrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                      <Calendar className="w-3.5 h-3.5" />
                      {totalShifts} {totalShifts === 1 ? "Shift" : "Shifts"}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      <Users className="w-3.5 h-3.5" />
                      {uniqueStaff} Staff
                    </span>
                    {totalShifts > 0 && (
                      <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-amber-50 text-amber-800 border border-amber-200">
                        <span>{morningCount} AM</span>
                        <span>·</span>
                        <span>{afternoonCount} PM</span>
                      </span>
                    )}

                    <button
                      type="button"
                      disabled={totalShifts === 0}
                      onClick={() =>
                        exportRowsToExcel(
                          group.rows,
                          `Shifts_${group.departmentName}`
                        )
                      }
                      className="btn-outline btn-sm flex items-center gap-1 text-xs py-1 px-2.5 disabled:opacity-40"
                      title={`Export ${group.departmentName} shifts to Excel`}
                    >
                      <Table className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Excel</span>
                    </button>

                    <button
                      type="button"
                      disabled={totalShifts === 0}
                      onClick={() =>
                        exportRowsToPDF(
                          group.rows,
                          `${group.departmentName} Department — Shift Schedule`
                        )
                      }
                      className="btn-outline btn-sm flex items-center gap-1 text-xs py-1 px-2.5 disabled:opacity-40"
                      title={`Export ${group.departmentName} shifts to PDF`}
                    >
                      <FileText className="w-3.5 h-3.5 text-red-600" />
                      <span>PDF</span>
                    </button>
                  </div>
                </div>

                {/* Expanded Department Shifts Table */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    {totalShifts === 0 ? (
                      <div className="p-8 text-center text-sm text-muted-foreground">
                        No shifts scheduled in <strong>{group.departmentName}</strong> for the selected filters.
                      </div>
                    ) : (
                      <table className="data-table">
                        <thead>
                          <tr>
                            {canDelete && (
                              <th className="w-10">
                                <button
                                  type="button"
                                  onClick={() => toggleAllInDept(group.rows)}
                                  className="p-1 text-gray-500 hover:text-primary"
                                  title="Select all in this department"
                                >
                                  {allDeptSelected ? (
                                    <CheckSquare className="w-4 h-4 text-primary" />
                                  ) : (
                                    <Square className="w-4 h-4" />
                                  )}
                                </button>
                              </th>
                            )}
                            <th>Work Date</th>
                            <th>Employee</th>
                            <th>Staff ID</th>
                            <th>Shift</th>
                            <th>Time</th>
                            <th>Status</th>
                            <th>Created By</th>
                            <th>Created On</th>
                            {canDelete && <th className="text-right">Action</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map((r) => {
                            const isSelected = selectedIds.has(r.id);
                            const isAM = r.startTime < "12:00";
                            return (
                              <tr
                                key={r.id}
                                className={isSelected ? "bg-primary/5" : ""}
                              >
                                {canDelete && (
                                  <td>
                                    <button
                                      type="button"
                                      onClick={() => toggleRow(r.id)}
                                      className="p-1 text-gray-500 hover:text-primary"
                                    >
                                      {isSelected ? (
                                        <CheckSquare className="w-4 h-4 text-primary" />
                                      ) : (
                                        <Square className="w-4 h-4" />
                                      )}
                                    </button>
                                  </td>
                                )}
                                <td className="font-medium whitespace-nowrap">
                                  {format(new Date(r.workDate), "EEE, dd MMM yyyy")}
                                </td>
                                <td className="font-semibold text-gray-900">
                                  {r.employeeName}
                                </td>
                                <td className="font-mono text-xs text-gray-600">
                                  {r.empCode}
                                </td>
                                <td>
                                  <span
                                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-white"
                                    style={{ backgroundColor: r.color || "#3B82F6" }}
                                  >
                                    {r.shiftName}
                                    <span className="text-[10px] opacity-90">
                                      ({isAM ? "AM" : "PM"})
                                    </span>
                                  </span>
                                </td>
                                <td className="text-xs text-gray-600 whitespace-nowrap">
                                  {r.startTime} – {r.endTime}
                                </td>
                                <td>
                                  <span
                                    className={`badge ${
                                      r.status === "CONFIRMED" || r.status === "SCHEDULED"
                                        ? "badge-success"
                                        : r.status === "CANCELLED"
                                        ? "badge-danger"
                                        : "badge-neutral"
                                    }`}
                                  >
                                    {r.status}
                                  </span>
                                </td>
                                <td>
                                  {r.createdByName ? (
                                    <div className="flex flex-col">
                                      <span className="text-xs font-medium text-gray-800">
                                        {r.createdByName}
                                      </span>
                                      {r.createdByRole && (
                                        <span className="text-[10px] text-gray-500">
                                          {r.createdByRole.replace(/_/g, " ")}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-gray-400">
                                      Admin / System
                                    </span>
                                  )}
                                </td>
                                <td className="text-xs text-gray-500 whitespace-nowrap">
                                  {format(new Date(r.createdAt), "dd MMM yyyy, HH:mm")}
                                </td>
                                {canDelete && (
                                  <td className="text-right">
                                    <button
                                      type="button"
                                      disabled={deleting}
                                      onClick={() =>
                                        handleDeleteIds(
                                          [r.id],
                                          `${r.employeeName}'s ${r.shiftName} shift on ${format(
                                            new Date(r.workDate),
                                            "dd MMM yyyy"
                                          )}`
                                        )
                                      }
                                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                      title="Delete shift"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
