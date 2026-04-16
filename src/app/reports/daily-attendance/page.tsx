"use client";

/**
 * /reports/daily-attendance — Attendance Intelligence Dashboard
 *
 * Accessible at: /reports/daily-attendance?date=YYYY-MM-DD[&deptId=N]
 *
 * Roles:
 *   HR_ADMIN / SUPER_ADMIN → full view with department filter
 *   HOD                   → locked to their department
 *   EMPLOYEE              → self view only
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { format, parseISO } from "date-fns";
import {
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Filter,
  Download,
  RefreshCw,
  Clock,
  Building2,
  Fingerprint,
  ShieldAlert,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttendanceRecord {
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
  durationMinutes: number | null;
  isShortShift: boolean;
  status: "ON_SHIFT_PRESENT" | "ON_SHIFT_ABSENT" | "OFF_SHIFT_PRESENT" | "NO_SHIFT_NO_PUNCH";
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
  summary: Summary;
  records: AttendanceRecord[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  try { return format(parseISO(iso), "HH:mm"); } catch { return "—"; }
}

function fmtDuration(minutes: number | null) {
  if (minutes === null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon: Icon,
  colorClass,
  bgClass,
  critical,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
  critical?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-white shadow-sm p-5 flex items-center justify-between transition-all duration-200 hover:shadow-md ${
        critical ? "border-red-300 ring-1 ring-red-200" : "border-gray-200"
      }`}
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">{label}</p>
        <p className={`text-3xl font-bold ${critical && value > 0 ? "text-red-600" : "text-primary"}`}>
          {value}
        </p>
        {critical && value > 0 && (
          <p className="text-[10px] text-red-500 font-semibold mt-0.5 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" /> Requires attention
          </p>
        )}
      </div>
      <div className={`p-3 rounded-xl ${bgClass}`}>
        <Icon className={`w-6 h-6 ${colorClass}`} />
      </div>
    </div>
  );
}

// ─── Status row highlight ─────────────────────────────────────────────────────

function rowHighlight(status: string) {
  if (status === "OFF_SHIFT_PRESENT") return "bg-orange-50/60";
  if (status === "ON_SHIFT_ABSENT")   return "bg-red-50/40";
  return "";
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DailyAttendanceDashboard() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [date, setDate]                 = useState(todayStr());
  const [deptFilter, setDeptFilter]     = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [data, setData]                 = useState<ApiResponse | null>(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const role = user?.role ?? "EMPLOYEE";
  const isAdminRole = ["HR_ADMIN", "SUPER_ADMIN", "SUPERVISOR"].includes(role);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ date });
      if (deptFilter) params.set("deptId", deptFilter);

      const res = await fetch(`/api/reports/daily-attendance?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }
      const json: ApiResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message ?? "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [date, deptFilter]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // ── Filtered records ─────────────────────────────────────────────────────
  const records = data?.records ?? [];
  const filtered = statusFilter
    ? records.filter((r) => r.status === statusFilter)
    : records;

  // ── Summary ───────────────────────────────────────────────────────────────
  const summary = data?.summary ?? {
    total: 0, onShiftPresent: 0, onShiftAbsent: 0, offShiftPresent: 0, noContext: 0,
  };

  // ── CSV Export ────────────────────────────────────────────────────────────
  function exportCSV() {
    const header = "Employee,Code,Department,Shift Start,Shift End,First Punch,Last Punch,Duration,Status,Device\n";
    const rows = filtered.map((r) => [
      `"${r.name}"`,
      r.empCode,
      `"${r.department}"`,
      r.shiftStart ?? "",
      r.shiftEnd ?? "",
      fmtTime(r.firstPunch),
      fmtTime(r.lastPunch),
      fmtDuration(r.durationMinutes),
      r.status,
      r.deviceUsed ?? "",
    ].join(",")).join("\n");

    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="page-container animate-fade-in">

      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Fingerprint className="w-6 h-6 text-primary" />
            Attendance Intelligence
          </h1>
          <p className="page-subtitle">
            Live classification of staff presence vs rota — {data ? format(parseISO(data.date), "PPP") : "—"}
          </p>
        </div>
        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          className="btn btn-secondary gap-2 text-sm"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* ── Filter Bar ── */}
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase">Date</label>
            <input
              id="attendance-date-picker"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input py-2 w-[160px]"
            />
          </div>

          {isAdminRole && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase">Department</label>
              <select
                id="attendance-dept-filter"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="input py-2 w-[200px]"
              >
                <option value="">All Departments</option>
                {/* Unique departments extracted from records */}
                {Array.from(new Set(records.map((r) => JSON.stringify({ id: r.departmentId, name: r.department }))))
                  .map((s) => {
                    const dept = JSON.parse(s);
                    return (
                      <option key={dept.id} value={dept.id ?? ""}>
                        {dept.name}
                      </option>
                    );
                  })
                }
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase">Status</label>
            <select
              id="attendance-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input py-2 w-[200px]"
            >
              <option value="">All Statuses</option>
              <option value="ON_SHIFT_PRESENT">On Shift · Present</option>
              <option value="ON_SHIFT_ABSENT">On Shift · Absent</option>
              <option value="OFF_SHIFT_PRESENT">Off Shift · Present</option>
              <option value="NO_SHIFT_NO_PUNCH">No Activity</option>
            </select>
          </div>

          <button
            id="attendance-refresh-btn"
            onClick={fetchReport}
            className="btn btn-primary gap-2 py-2"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-5 py-3 text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Summary Cards (Big Cards) ── */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Staff", value: summary.total, icon: Users, color: "text-primary", bg: "bg-blue-50" },
          { label: "On Shift · Present", value: summary.onShiftPresent, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "On Shift · Absent", value: summary.onShiftAbsent, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
          { label: "Off Shift · Present", value: summary.offShiftPresent, icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50", critical: true },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div 
              key={card.label} 
              className={`big-metric-card animate-slide-up ${card.critical && card.value > 0 ? "border-red-200 ring-2 ring-red-50" : ""}`}
            >
              <div className="big-metric-icon-bg bg-white shadow-sm ring-1 ring-border/50">
                <Icon className={`w-6 h-6 ${card.color}`} />
              </div>
              <div>
                <p className="big-metric-label">{card.label}</p>
                <div className="flex items-baseline gap-2">
                  <p className={`big-metric-value ${card.critical && card.value > 0 ? "text-red-600" : card.color}`}>
                    {card.value}
                  </p>
                </div>
                {card.critical && card.value > 0 && (
                  <p className="text-[10px] text-red-500 font-bold mt-2 flex items-center gap-1 uppercase tracking-tighter">
                    <ShieldAlert className="w-3 h-3" /> Requires attention
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Data Table ── */}
      <div className="card overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <p className="text-sm font-semibold text-gray-700">
            {loading ? "Loading…" : `${filtered.length} of ${records.length} employees`}
          </p>
          {statusFilter && (
            <button
              onClick={() => setStatusFilter("")}
              className="text-xs text-gray-500 hover:text-primary underline"
            >
              Clear filter
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Employee</th>
                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Department</th>
                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Shift</th>
                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">First Punch</th>
                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Last Punch</th>
                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Duration</th>
                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Status</th>
                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Device</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                /* Skeleton rows */
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-3 bg-gray-200 rounded w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Fingerprint className="w-8 h-8 text-gray-300" />
                      <p className="font-medium text-gray-400">No records found for this selection</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.employeeId}
                    id={`row-emp-${r.employeeId}`}
                    className={`hover:bg-gray-50/70 transition-colors ${rowHighlight(r.status)}`}
                  >
                    {/* Employee */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <p className="font-semibold text-primary">{r.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{r.empCode}</p>
                    </td>

                    {/* Department */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        {r.department}
                      </span>
                    </td>

                    {/* Shift window */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {r.shiftStart ? (
                        <div className="flex flex-col">
                          <span className="font-mono text-sm text-gray-800">
                            {r.shiftStart} – {r.shiftEnd}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{r.shiftTemplateName}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">No shift</span>
                      )}
                    </td>

                    {/* First punch */}
                    <td className="px-5 py-3.5 whitespace-nowrap font-mono text-sm">
                      {fmtTime(r.firstPunch)}
                    </td>

                    {/* Last punch */}
                    <td className="px-5 py-3.5 whitespace-nowrap font-mono text-sm">
                      {fmtTime(r.lastPunch)}
                    </td>

                    {/* Duration */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span
                        className={`font-semibold text-sm ${
                          r.isShortShift ? "text-orange-600" : "text-gray-700"
                        }`}
                      >
                        {fmtDuration(r.durationMinutes)}
                      </span>
                      {r.isShortShift && (
                        <span className="ml-1 text-[10px] text-orange-500 font-bold">SHORT</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <StatusBadge status={r.status} />
                    </td>

                    {/* Device */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-gray-500">
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
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> On Shift · Present
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" /> On Shift · Absent
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-500" /> Off Shift · Present (critical flag)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gray-400" /> No Activity
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
