"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import {
  DoorOpen,
  Utensils,
  Columns,
  Table,
  FileText,
  Users,
  Building2,
  Clock,
  Fingerprint,
} from "lucide-react";

export interface PunchRow {
  id: number;
  empId: number | null;
  empCode: string;
  fullName: string;
  department: string;
  departmentId: number | null;
  punchTime: string; // ISO string
  deviceCategory: "STAFF_GATE" | "CANTEEN";
  deviceLabel: string;
  terminalSn: string;
}

interface PunchesClientProps {
  punches: PunchRow[];
}

export function PunchesClient({ punches }: PunchesClientProps) {
  const [activeTab, setActiveTab] = useState<"STAFF_GATE" | "CANTEEN" | "SPLIT">(
    "STAFF_GATE"
  );
  const [gateViewMode, setGateViewMode] = useState<"SUMMARY" | "RAW">("SUMMARY");

  const staffGatePunches = useMemo(
    () => punches.filter((p) => p.deviceCategory === "STAFF_GATE"),
    [punches]
  );

  const canteenPunches = useMemo(
    () => punches.filter((p) => p.deviceCategory === "CANTEEN"),
    [punches]
  );

  // Group Staff Gate punches by (empCode + date) for a clean First-In / Last-Out summary
  const gateDailySummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        dateStr: string;
        empCode: string;
        fullName: string;
        department: string;
        firstIn: string;
        lastOut: string | null;
        allTimes: string[];
        durationMinutes: number | null;
      }
    >();

    // Sort ascending by time first so firstIn is earliest and lastOut is latest
    const sorted = [...staffGatePunches].sort(
      (a, b) => new Date(a.punchTime).getTime() - new Date(b.punchTime).getTime()
    );

    for (const p of sorted) {
      const dateStr = p.punchTime.slice(0, 10);
      const key = `${p.empCode}|${dateStr}`;
      const timeStr = format(new Date(p.punchTime), "HH:mm:ss");
      if (!map.has(key)) {
        map.set(key, {
          key,
          dateStr,
          empCode: p.empCode,
          fullName: p.fullName,
          department: p.department,
          firstIn: p.punchTime,
          lastOut: null,
          allTimes: [timeStr],
          durationMinutes: null,
        });
      } else {
        const entry = map.get(key)!;
        entry.lastOut = p.punchTime;
        entry.allTimes.push(timeStr);
        entry.durationMinutes = Math.max(
          0,
          Math.round(
            (new Date(p.punchTime).getTime() - new Date(entry.firstIn).getTime()) /
              60000
          )
        );
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      b.dateStr !== a.dateStr
        ? b.dateStr.localeCompare(a.dateStr)
        : a.fullName.localeCompare(b.fullName)
    );
  }, [staffGatePunches]);

  const uniqueGateStaff = new Set(staffGatePunches.map((p) => p.empCode)).size;
  const uniqueCanteenStaff = new Set(canteenPunches.map((p) => p.empCode)).size;
  const activeDepts = new Set(
    punches.map((p) => p.department).filter((d) => d && d !== "—")
  ).size;

  const exportToExcel = (targetRows: PunchRow[], label: string) => {
    if (targetRows.length === 0) {
      alert(`No ${label} punches to export.`);
      return;
    }
    const headers = [
      "Date",
      "Time",
      "Employee Name",
      "Staff ID",
      "Department",
      "Device",
      "Terminal SN",
    ];
    const csvRows = targetRows.map((p) => [
      format(new Date(p.punchTime), "yyyy-MM-dd"),
      format(new Date(p.punchTime), "HH:mm:ss"),
      p.fullName,
      p.empCode,
      p.department,
      p.deviceLabel,
      p.terminalSn,
    ]);

    const csvContent =
      "\uFEFF" +
      [
        headers.map((h) => `"${h}"`).join(","),
        ...csvRows.map((r) =>
          r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
        ),
      ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${label.replace(/\s+/g, "_")}_${format(
      new Date(),
      "yyyy-MM-dd"
    )}.csv`;
    link.click();
  };

  const exportToPDF = (targetRows: PunchRow[], title: string) => {
    if (targetRows.length === 0) {
      alert(`No punches to export for ${title}.`);
      return;
    }
    const win = window.open("", "_blank", "width=1000,height=800");
    if (!win) {
      window.print();
      return;
    }
    const rowsHtml = targetRows
      .map(
        (p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${format(new Date(p.punchTime), "dd MMM yyyy")}</td>
        <td><strong>${format(new Date(p.punchTime), "HH:mm:ss")}</strong></td>
        <td><strong>${p.fullName}</strong></td>
        <td>${p.empCode}</td>
        <td>${p.department}</td>
        <td>${p.deviceLabel}</td>
      </tr>`
      )
      .join("");

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
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
              <h1>${title}</h1>
              <div style="font-size:12px;color:#475569;">WorkforceOps Biometric Report</div>
            </div>
            <div style="font-size:12px;text-align:right;color:#475569;">
              <div><strong>Generated:</strong> ${format(new Date(), "dd MMM yyyy, HH:mm")}</div>
              <div><strong>Total Punches:</strong> ${targetRows.length}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Punch Time</th>
                <th>Employee</th>
                <th>Staff ID</th>
                <th>Department</th>
                <th>Device</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="space-y-5">
      {/* Summary KPI Cards separating Staff Gate vs Canteen Device */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => setActiveTab("STAFF_GATE")}
          className={`cursor-pointer rounded-2xl border p-4 flex items-center justify-between transition-all ${
            activeTab === "STAFF_GATE"
              ? "border-blue-500 bg-blue-50/40 ring-2 ring-blue-500/20"
              : "border-border bg-white hover:border-blue-300"
          }`}
        >
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-700">
              <DoorOpen className="w-4 h-4" />
              Staff Gate (Attendance)
            </span>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {staffGatePunches.length}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                punches ({uniqueGateStaff} staff)
              </span>
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Clock-in &amp; Clock-out terminal (SN: TTQ5251600205)
            </p>
          </div>
          <div className="p-3 rounded-xl bg-blue-100 text-blue-700">
            <DoorOpen className="w-6 h-6" />
          </div>
        </div>

        <div
          onClick={() => setActiveTab("CANTEEN")}
          className={`cursor-pointer rounded-2xl border p-4 flex items-center justify-between transition-all ${
            activeTab === "CANTEEN"
              ? "border-amber-500 bg-amber-50/40 ring-2 ring-amber-500/20"
              : "border-border bg-white hover:border-amber-300"
          }`}
        >
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700">
              <Utensils className="w-4 h-4" />
              Canteen Device (Meals)
            </span>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {canteenPunches.length}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                punches ({uniqueCanteenStaff} staff)
              </span>
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Canteen meal ticket terminal (SN: TTQ5251600240)
            </p>
          </div>
          <div className="p-3 rounded-xl bg-amber-100 text-amber-700">
            <Utensils className="w-6 h-6" />
          </div>
        </div>

        <div
          onClick={() => setActiveTab("SPLIT")}
          className={`cursor-pointer rounded-2xl border p-4 flex items-center justify-between transition-all ${
            activeTab === "SPLIT"
              ? "border-purple-500 bg-purple-50/40 ring-2 ring-purple-500/20"
              : "border-border bg-white hover:border-purple-300"
          }`}
        >
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-700">
              <Columns className="w-4 h-4" />
              Side-by-Side Split View
            </span>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {activeDepts}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                active departments
              </span>
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Compare Staff Gate &amp; Canteen side by side
            </p>
          </div>
          <div className="p-3 rounded-xl bg-purple-100 text-purple-700">
            <Columns className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Device Switcher Tabs + Export Controls */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-border bg-gray-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab("STAFF_GATE")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === "STAFF_GATE"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-white text-gray-700 border border-border hover:bg-gray-100"
              }`}
            >
              <DoorOpen className="w-4 h-4" />
              Staff Gate Only ({staffGatePunches.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("CANTEEN")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === "CANTEEN"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-white text-gray-700 border border-border hover:bg-gray-100"
              }`}
            >
              <Utensils className="w-4 h-4" />
              Canteen Device Only ({canteenPunches.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("SPLIT")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === "SPLIT"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-white text-gray-700 border border-border hover:bg-gray-100"
              }`}
            >
              <Columns className="w-4 h-4" />
              Side-by-Side View
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {activeTab === "STAFF_GATE" && (
              <div className="inline-flex rounded-lg border border-border bg-white p-0.5 mr-2">
                <button
                  type="button"
                  onClick={() => setGateViewMode("SUMMARY")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    gateViewMode === "SUMMARY"
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Daily In/Out Summary ({gateDailySummaries.length})
                </button>
                <button
                  type="button"
                  onClick={() => setGateViewMode("RAW")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    gateViewMode === "RAW"
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Raw Punches ({staffGatePunches.length})
                </button>
              </div>
            )}

            {activeTab !== "CANTEEN" && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    exportToExcel(staffGatePunches, "Staff_Gate_Punches")
                  }
                  className="btn-outline btn-sm text-xs flex items-center gap-1.5"
                >
                  <Table className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Staff Gate Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportToPDF(
                      staffGatePunches,
                      "Staff Gate — Biometric Attendance Punches"
                    )
                  }
                  className="btn-outline btn-sm text-xs flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-red-600" />
                  <span>Staff Gate PDF</span>
                </button>
              </>
            )}

            {activeTab !== "STAFF_GATE" && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    exportToExcel(canteenPunches, "Canteen_Device_Punches")
                  }
                  className="btn-outline btn-sm text-xs flex items-center gap-1.5"
                >
                  <Table className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Canteen Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportToPDF(
                      canteenPunches,
                      "Canteen Device — Meal Ticket Biometric Log"
                    )
                  }
                  className="btn-outline btn-sm text-xs flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-red-600" />
                  <span>Canteen PDF</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* TAB 1: STAFF GATE ONLY */}
        {activeTab === "STAFF_GATE" && (
          <div className="overflow-x-auto">
            {staffGatePunches.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No <strong>Staff Gate</strong> punches found for the selected filter.
              </div>
            ) : gateViewMode === "SUMMARY" ? (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-blue-50/30">
                  <tr>
                    <th className="px-5 py-3.5 text-left font-semibold">Date</th>
                    <th className="px-5 py-3.5 text-left font-semibold">Employee</th>
                    <th className="px-5 py-3.5 text-left font-semibold">Staff ID</th>
                    <th className="px-5 py-3.5 text-left font-semibold">Department</th>
                    <th className="px-5 py-3.5 text-left font-semibold">First Punch (In)</th>
                    <th className="px-5 py-3.5 text-left font-semibold">Last Punch (Out)</th>
                    <th className="px-5 py-3.5 text-left font-semibold">Duration</th>
                    <th className="px-5 py-3.5 text-left font-semibold">All Gate Punches</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {gateDailySummaries.map((s) => (
                    <tr key={s.key} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3.5 font-medium whitespace-nowrap text-gray-700">
                        {format(new Date(s.dateStr), "EEE, dd MMM yyyy")}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-gray-900">
                        {s.fullName}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                          {s.empCode}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">{s.department}</td>
                      <td className="px-5 py-3.5 font-mono text-xs font-bold text-emerald-700">
                        {format(new Date(s.firstIn), "HH:mm:ss")}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs font-bold text-blue-700">
                        {s.lastOut ? (
                          format(new Date(s.lastOut), "HH:mm:ss")
                        ) : (
                          <span className="text-amber-600 font-normal text-xs">
                            Single punch
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs font-semibold text-gray-700">
                        {s.durationMinutes != null && s.durationMinutes > 0
                          ? `${Math.floor(s.durationMinutes / 60)}h ${
                              s.durationMinutes % 60
                            }m`
                          : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {s.allTimes.map((t, idx) => (
                            <span
                              key={idx}
                              className="font-mono text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-blue-50/30">
                  <tr>
                    <th className="px-5 py-3.5 text-left font-semibold">Date</th>
                    <th className="px-5 py-3.5 text-left font-semibold">Punch Time</th>
                    <th className="px-5 py-3.5 text-left font-semibold">Employee</th>
                    <th className="px-5 py-3.5 text-left font-semibold">Staff ID</th>
                    <th className="px-5 py-3.5 text-left font-semibold">Department</th>
                    <th className="px-5 py-3.5 text-left font-semibold">Device</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {staffGatePunches.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3.5 font-medium whitespace-nowrap text-gray-700">
                        {format(new Date(p.punchTime), "EEE, dd MMM yyyy")}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs font-bold text-blue-700">
                        {format(new Date(p.punchTime), "HH:mm:ss")}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-gray-900">
                        {p.fullName}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                          {p.empCode}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">{p.department}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          <DoorOpen className="w-3.5 h-3.5" />
                          Staff Gate
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 2: CANTEEN DEVICE ONLY */}
        {activeTab === "CANTEEN" && (
          <div className="overflow-x-auto">
            {canteenPunches.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No <strong>Canteen Device</strong> meal punches found for the selected filter.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-amber-50/40">
                  <tr>
                    <th className="px-5 py-3.5 text-left font-semibold">Date</th>
                    <th className="px-5 py-3.5 text-left font-semibold">Meal Time</th>
                    <th className="px-5 py-3.5 text-left font-semibold">Period</th>
                    <th className="px-5 py-3.5 text-left font-semibold">Employee</th>
                    <th className="px-5 py-3.5 text-left font-semibold">Staff ID</th>
                    <th className="px-5 py-3.5 text-left font-semibold">Department</th>
                    <th className="px-5 py-3.5 text-left font-semibold">Device</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {canteenPunches.map((p) => {
                    const hour = new Date(p.punchTime).getUTCHours();
                    const period =
                      hour < 12
                        ? "Morning (AM Meal)"
                        : hour < 17
                        ? "Afternoon (Lunch)"
                        : "Evening (Dinner)";
                    return (
                      <tr key={p.id} className="hover:bg-gray-50/50">
                        <td className="px-5 py-3.5 font-medium whitespace-nowrap text-gray-700">
                          {format(new Date(p.punchTime), "EEE, dd MMM yyyy")}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs font-bold text-amber-700">
                          {format(new Date(p.punchTime), "HH:mm:ss")}
                        </td>
                        <td className="px-5 py-3.5 text-xs font-medium text-gray-700">
                          {period}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-gray-900">
                          {p.fullName}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                            {p.empCode}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-600">{p.department}</td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            <Utensils className="w-3.5 h-3.5" />
                            Canteen Device
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 3: SIDE-BY-SIDE SPLIT VIEW */}
        {activeTab === "SPLIT" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">
            {/* Left Column: Staff Gate */}
            <div>
              <div className="px-4 py-3 bg-blue-50/50 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DoorOpen className="w-4 h-4 text-blue-700" />
                  <span className="font-bold text-sm text-blue-950">
                    Staff Gate — Attendance ({staffGatePunches.length})
                  </span>
                </div>
                <span className="text-xs text-blue-700 font-medium">
                  {uniqueGateStaff} unique staff
                </span>
              </div>
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                {staffGatePunches.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    No Staff Gate punches in this period.
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="text-[11px] text-muted-foreground uppercase border-b border-border bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3.5 py-2.5 text-left">Date &amp; Time</th>
                        <th className="px-3.5 py-2.5 text-left">Employee</th>
                        <th className="px-3.5 py-2.5 text-left">Department</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {staffGatePunches.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50/60">
                          <td className="px-3.5 py-2.5 font-mono whitespace-nowrap">
                            <div className="font-bold text-blue-700">
                              {format(new Date(p.punchTime), "HH:mm:ss")}
                            </div>
                            <div className="text-[10px] text-gray-500">
                              {format(new Date(p.punchTime), "dd MMM yyyy")}
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <div className="font-semibold text-gray-900">
                              {p.fullName}
                            </div>
                            <div className="font-mono text-[10px] text-gray-500">
                              {p.empCode}
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5 text-gray-600">
                            {p.department}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Right Column: Canteen Device */}
            <div>
              <div className="px-4 py-3 bg-amber-50/50 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-amber-700" />
                  <span className="font-bold text-sm text-amber-950">
                    Canteen Device — Meal Tickets ({canteenPunches.length})
                  </span>
                </div>
                <span className="text-xs text-amber-700 font-medium">
                  {uniqueCanteenStaff} unique staff
                </span>
              </div>
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                {canteenPunches.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    No Canteen Device punches in this period.
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="text-[11px] text-muted-foreground uppercase border-b border-border bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3.5 py-2.5 text-left">Date &amp; Time</th>
                        <th className="px-3.5 py-2.5 text-left">Employee</th>
                        <th className="px-3.5 py-2.5 text-left">Department</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {canteenPunches.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50/60">
                          <td className="px-3.5 py-2.5 font-mono whitespace-nowrap">
                            <div className="font-bold text-amber-700">
                              {format(new Date(p.punchTime), "HH:mm:ss")}
                            </div>
                            <div className="text-[10px] text-gray-500">
                              {format(new Date(p.punchTime), "dd MMM yyyy")}
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <div className="font-semibold text-gray-900">
                              {p.fullName}
                            </div>
                            <div className="font-mono text-[10px] text-gray-500">
                              {p.empCode}
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5 text-gray-600">
                            {p.department}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
