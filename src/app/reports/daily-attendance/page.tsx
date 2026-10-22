"use client";

/**
 * /reports/daily-attendance — Attendance Intelligence Dashboard (Presence vs. Rota)
 */

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { format, parseISO } from "date-fns";
import {
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  RefreshCw,
  Clock,
  Building2,
  Fingerprint,
  ShieldAlert,
  Search,
  FileText,
  Table,
  Utensils,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface AttendanceRecord {
  key: string;
  workDate: string;
  employeeId: number;
  empCode: string;
  name: string;
  department: string;
  departmentId: number | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  shiftTemplateName: string | null;
  firstPunch: string | null;
  lastPunch: string | null;
  canteenPunches: string[];
  durationMinutes: number | null;
  isShortShift: boolean;
  status:
    | "ON_SHIFT_PRESENT"
    | "ON_SHIFT_ABSENT"
    | "OFF_SHIFT_PRESENT"
    | "NO_SHIFT_NO_PUNCH";
  deviceUsed: string | null;
}

interface Summary {
  total: number;
  onShiftPresent: number;
  onShiftAbsent: number;
  offShiftPresent: number;
  noContext: number;
}

interface ApiResponse {
  date: string;
  endDate: string;
  departments: { id: number; name: string }[];
  summary: Summary;
  records: AttendanceRecord[];
}

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "HH:mm:ss");
  } catch {
    return "—";
  }
}

function fmtDuration(minutes: number | null) {
  if (minutes === null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function rowHighlight(status: string) {
  if (status === "OFF_SHIFT_PRESENT") return "bg-orange-50/60";
  if (status === "ON_SHIFT_ABSENT") return "bg-red-50/40";
  if (status === "ON_SHIFT_PRESENT") return "bg-emerald-50/30";
  return "";
}

export default function DailyAttendanceDashboard() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [hideInactive, setHideInactive] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const role = user?.role ?? "EMPLOYEE";
  const isAdminRole = ["HR_ADMIN", "SUPER_ADMIN"].includes(role);

  const fetchReport = useCallback(
    async (overrideDate?: string, overrideEndDate?: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        const d = overrideDate !== undefined ? overrideDate : date;
        const ed = overrideEndDate !== undefined ? overrideEndDate : endDate;
        if (d) params.set("date", d);
        if (ed) params.set("endDate", ed);
        if (deptFilter) params.set("deptId", deptFilter);

        const res = await fetch(`/api/reports/daily-attendance?${params}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Error ${res.status}`);
        }
        const json: ApiResponse = await res.json();
        setData(json);
        if (!d && json.date) setDate(json.date);
        if (!ed && json.endDate) setEndDate(json.endDate);
      } catch (err: any) {
        setError(err.message ?? "Failed to load report");
      } finally {
        setLoading(false);
      }
    },
    [date, endDate, deptFilter]
  );

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const records = data?.records ?? [];
  const filtered = records.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (hideInactive && !statusFilter && r.status === "NO_SHIFT_NO_PUNCH") {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (
        !r.name.toLowerCase().includes(q) &&
        !r.empCode.toLowerCase().includes(q) &&
        !r.department.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const summary = data?.summary ?? {
    total: 0,
    onShiftPresent: 0,
    onShiftAbsent: 0,
    offShiftPresent: 0,
    noContext: 0,
  };

  const activeTotal =
    summary.onShiftPresent + summary.onShiftAbsent + summary.offShiftPresent;

  function exportCSV() {
    if (filtered.length === 0) return;
    const headers = [
      "Date",
      "Employee",
      "Staff ID",
      "Department",
      "Rota Shift",
      "Shift Hours",
      "Staff Gate First Punch",
      "Staff Gate Last Punch",
      "Canteen Meal Punches",
      "Duration",
      "Status",
      "Device",
    ];
    const rows = filtered.map((r) =>
      [
        r.workDate,
        r.name,
        r.empCode,
        r.department,
        r.shiftTemplateName ?? "No Shift",
        r.shiftStart ? `${r.shiftStart} - ${r.shiftEnd}` : "—",
        fmtTime(r.firstPunch),
        fmtTime(r.lastPunch),
        r.canteenPunches?.length ? r.canteenPunches.join(", ") : "—",
        fmtDuration(r.durationMinutes),
        r.status,
        r.deviceUsed ?? "—",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );

    const blob = new Blob(
      ["\uFEFF" + headers.map((h) => `"${h}"`).join(",") + "\n" + rows.join("\n")],
      { type: "text/csv;charset=utf-8;" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-intelligence-${date || "report"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    if (filtered.length === 0) return;
    const win = window.open("", "_blank", "width=1100,height=800");
    if (!win) {
      window.print();
      return;
    }
    const rowsHtml = filtered
      .map(
        (r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.workDate}</td>
        <td><strong>${r.name}</strong> (${r.empCode})</td>
        <td>${r.department}</td>
        <td>${
          r.shiftTemplateName
            ? `${r.shiftTemplateName} (${r.shiftStart}–${r.shiftEnd})`
            : "No Shift"
        }</td>
        <td>${fmtTime(r.firstPunch)}</td>
        <td>${fmtTime(r.lastPunch)}</td>
        <td>${r.canteenPunches?.length ? r.canteenPunches.join(", ") : "—"}</td>
        <td>${fmtDuration(r.durationMinutes)}</td>
        <td>${r.status.replace(/_/g, " ")}</td>
      </tr>`
      )
      .join("");

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Attendance Intelligence Report (Presence vs Rota)</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #111827; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #1e293b; padding-bottom: 10px; margin-bottom: 16px; }
            h1 { margin: 0; font-size: 18px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
            th { background: #f1f5f9; text-transform: uppercase; font-size: 10px; }
            tr:nth-child(even) { background: #f8fafc; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>Attendance Intelligence — Presence vs. Rota</h1>
              <div style="font-size:12px;color:#475569;">Period: ${date} to ${endDate}</div>
            </div>
            <div style="font-size:12px;text-align:right;color:#475569;">
              <div><strong>Generated:</strong> ${format(new Date(), "dd MMM yyyy, HH:mm")}</div>
              <div><strong>Records:</strong> ${filtered.length}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Employee</th>
                <th>Department</th>
                <th>Rota Shift</th>
                <th>Gate In</th>
                <th>Gate Out</th>
                <th>Canteen</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `);
    win.document.close();
  }

  return (
    <div className="page-container animate-fade-in space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Fingerprint className="w-6 h-6 text-primary" />
            Attendance Intelligence
          </h1>
          <p className="page-subtitle">
            Live classification of Staff Gate presence vs. scheduled rota
            {data?.date
              ? ` (${data.date}${
                  data.endDate && data.endDate !== data.date
                    ? ` to ${data.endDate}`
                    : ""
                })`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="btn-outline btn-sm flex items-center gap-1.5"
          >
            <Table className="w-4 h-4 text-emerald-600" />
            <span>Excel</span>
          </button>
          <button
            onClick={exportPDF}
            disabled={filtered.length === 0}
            className="btn-outline btn-sm flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4 text-red-600" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">
              From Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input py-2 w-[150px]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input py-2 w-[150px]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">
              Search Staff
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Name or Staff ID..."
                className="input pl-9 py-2 w-[190px]"
              />
            </div>
          </div>

          {isAdminRole && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">
                Department
              </label>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="input py-2 w-[190px]"
              >
                <option value="">All Departments</option>
                {(data?.departments ?? []).map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input py-2 w-[190px]"
            >
              <option value="">All Active Statuses</option>
              <option value="ON_SHIFT_PRESENT">On Shift · Present</option>
              <option value="ON_SHIFT_ABSENT">On Shift · Absent</option>
              <option value="OFF_SHIFT_PRESENT">Off Shift · Present</option>
              <option value="NO_SHIFT_NO_PUNCH">No Activity</option>
            </select>
          </div>

          <button
            onClick={() => fetchReport()}
            className="btn btn-primary gap-2 py-2"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Loading…" : "Apply / Refresh"}
          </button>

          <button
            type="button"
            onClick={() => {
              const t = new Date().toISOString().split("T")[0];
              setDate(t);
              setEndDate(t);
              fetchReport(t, t);
            }}
            className="btn btn-secondary py-2 text-xs"
          >
            Today Only
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-5 py-3 text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Summary Cards (Clickable to filter by status) */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Active Rota / Punches",
            value: activeTotal,
            filterVal: "",
            icon: Users,
            color: "text-primary",
          },
          {
            label: "On Shift · Present",
            value: summary.onShiftPresent,
            filterVal: "ON_SHIFT_PRESENT",
            icon: CheckCircle2,
            color: "text-emerald-600",
          },
          {
            label: "On Shift · Absent",
            value: summary.onShiftAbsent,
            filterVal: "ON_SHIFT_ABSENT",
            icon: XCircle,
            color: "text-red-600",
          },
          {
            label: "Off Shift · Present",
            value: summary.offShiftPresent,
            filterVal: "OFF_SHIFT_PRESENT",
            icon: AlertTriangle,
            color: "text-orange-600",
            critical: true,
          },
        ].map((card) => {
          const Icon = card.icon;
          const isSelected = statusFilter === card.filterVal && card.filterVal !== "";
          return (
            <div
              key={card.label}
              onClick={() =>
                setStatusFilter(
                  statusFilter === card.filterVal ? "" : card.filterVal
                )
              }
              className={`big-metric-card cursor-pointer transition-all ${
                isSelected ? "ring-2 ring-primary border-primary" : ""
              } ${
                card.critical && card.value > 0
                  ? "border-red-200 ring-1 ring-red-100"
                  : ""
              }`}
            >
              <div className="big-metric-icon-bg bg-white shadow-sm ring-1 ring-border/50">
                <Icon className={`w-6 h-6 ${card.color}`} />
              </div>
              <div>
                <p className="big-metric-label">{card.label}</p>
                <div className="flex items-baseline gap-2">
                  <p
                    className={`big-metric-value ${
                      card.critical && card.value > 0
                        ? "text-red-600"
                        : card.color
                    }`}
                  >
                    {card.value}
                  </p>
                </div>
                {card.critical && card.value > 0 && (
                  <p className="text-[10px] text-red-500 font-bold mt-2 flex items-center gap-1 uppercase tracking-tighter">
                    <ShieldAlert className="w-3 h-3" /> Unscheduled presence
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Data Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 flex-wrap gap-2">
          <p className="text-sm font-semibold text-gray-700">
            {loading
              ? "Loading…"
              : `Showing ${filtered.length} Presence vs. Rota record(s)`}
          </p>
          <div className="flex items-center gap-4">
            {summary.noContext > 0 && (
              <label className="inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideInactive}
                  onChange={(e) => setHideInactive(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Hide staff with no shift &amp; no punch ({summary.noContext})
              </label>
            )}
            {statusFilter && (
              <button
                onClick={() => setStatusFilter("")}
                className="text-xs text-gray-500 hover:text-primary underline"
              >
                Clear status filter
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">
                  Date
                </th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">
                  Employee
                </th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">
                  Department
                </th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">
                  Rota Shift
                </th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">
                  Gate First In
                </th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">
                  Gate Last Out
                </th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">
                  Canteen Meal
                </th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">
                  Duration
                </th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">
                  Device
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-3 bg-gray-200 rounded w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-5 py-16 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Fingerprint className="w-8 h-8 text-gray-300" />
                      <p className="font-medium text-gray-500">
                        No active records match your current filter.
                      </p>
                      {hideInactive && summary.noContext > 0 && (
                        <button
                          type="button"
                          onClick={() => setHideInactive(false)}
                          className="btn-secondary btn-sm text-xs mt-1"
                        >
                          Show all {summary.noContext} unscheduled staff
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.key}
                    className={`hover:bg-gray-50/70 transition-colors ${rowHighlight(
                      r.status
                    )}`}
                  >
                    <td className="px-4 py-3.5 whitespace-nowrap font-medium text-gray-700 text-xs">
                      {format(parseISO(r.workDate), "EEE, dd MMM yyyy")}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <p className="font-semibold text-primary">{r.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {r.empCode}
                      </p>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        {r.department}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {r.shiftStart ? (
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs text-blue-700">
                            {r.shiftTemplateName}
                          </span>
                          <span className="font-mono text-[11px] text-gray-600">
                            {r.shiftStart} – {r.shiftEnd}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">No shift</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs font-bold text-emerald-700">
                      {fmtTime(r.firstPunch)}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs font-bold text-blue-700">
                      {fmtTime(r.lastPunch)}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {r.canteenPunches && r.canteenPunches.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {r.canteenPunches.map((t, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200"
                            >
                              <Utensils className="w-3 h-3" />
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`font-semibold text-xs ${
                          r.isShortShift ? "text-orange-600" : "text-gray-700"
                        }`}
                      >
                        {fmtDuration(r.durationMinutes)}
                      </span>
                      {r.isShortShift && (
                        <span className="ml-1 text-[10px] text-orange-500 font-bold">
                          SHORT
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <StatusBadge status={r.status} size="sm" />
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap text-xs text-gray-600 font-medium">
                      {r.deviceUsed ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex flex-wrap gap-4 text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> On Shift ·
            Present
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" /> On Shift ·
            Absent
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-500" /> Off Shift ·
            Present (unscheduled punch)
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            Short shift = worked &lt; 2 hours
          </span>
        </div>
      </div>
    </div>
  );
}
