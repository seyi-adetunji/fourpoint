"use client";

import { useState, useMemo } from "react";
import { eachDayOfInterval, format } from "date-fns";
import {
  DoorOpen,
  Utensils,
  Columns,
  Table,
  FileText,
  Grid3X3,
} from "lucide-react";
import {
  exportTimesheetExcel,
  exportTimesheetPDF,
  type TimesheetEmployee,
  type TimesheetRow,
} from "@/lib/timesheetExport";

export interface PunchRow {
  id: number;
  empId: number | null;
  empCode: string;
  fullName: string;
  surname: string;
  givenNames: string;
  department: string;
  departmentId: number | null;
  punchTime: string; // ISO string
  deviceCategory: "STAFF_GATE" | "CANTEEN";
  deviceLabel: string;
  terminalSn: string;
}

export interface ScopedEmployeeInfo {
  empCode: string;
  fullName: string;
  surname: string;
  givenNames: string;
  department: string;
}

interface PunchesClientProps {
  punches: PunchRow[];
  timesheetPunches: PunchRow[];
  timesheetStartDate: string; // YYYY-MM-DD
  timesheetEndDate: string; // YYYY-MM-DD
  shiftCountsByEmpDate: Record<string, number>;
  scopedEmployees: ScopedEmployeeInfo[];
  departmentLabel: string;
  preparedBy: string;
}

const DOW_SHORT: Record<number, string> = {
  0: "Su",
  1: "M",
  2: "Tu",
  3: "W",
  4: "Th",
  5: "F",
  6: "Sa",
};

/**
 * Computes FT Associate Time Sheet rows (✓ = 1 shift, ✓✓ = double shift, 0 = off/absent)
 * for either STAFF_GATE or CANTEEN punches.
 */
function buildTimesheetRows(
  devicePunches: PunchRow[],
  deviceCategory: "STAFF_GATE" | "CANTEEN",
  startDateStr: string,
  endDateStr: string,
  shiftCountsByEmpDate: Record<string, number>,
  scopedEmployees: ScopedEmployeeInfo[]
): TimesheetRow[] {
  const empMap = new Map<string, TimesheetEmployee>();

  // If a specific department was filtered, include all employees of that department
  for (const emp of scopedEmployees) {
    empMap.set(emp.empCode, {
      empCode: emp.empCode,
      department: emp.department,
      surname: emp.surname,
      givenNames: emp.givenNames,
      fullName: emp.fullName,
    });
  }

  // Group punch timestamps (in ms) per employee per date
  const punchesByEmpDate = new Map<string, number[]>();

  for (const p of devicePunches) {
    if (!empMap.has(p.empCode)) {
      empMap.set(p.empCode, {
        empCode: p.empCode,
        department: p.department,
        surname: p.surname,
        givenNames: p.givenNames,
        fullName: p.fullName,
      });
    }
    const dStr = format(new Date(p.punchTime), "yyyy-MM-dd");
    const key = `${p.empCode}|${dStr}`;
    const arr = punchesByEmpDate.get(key) || [];
    arr.push(new Date(p.punchTime).getTime());
    punchesByEmpDate.set(key, arr);
  }

  const start = new Date(`${startDateStr}T00:00:00`);
  const end = new Date(`${endDateStr}T00:00:00`);
  const allDays = eachDayOfInterval({
    start: start <= end ? start : end,
    end: end >= start ? end : start,
  }).map((d) => format(d, "yyyy-MM-dd"));

  const sortedEmployees = Array.from(empMap.values()).sort((a, b) => {
    if (a.department !== b.department) {
      return a.department.localeCompare(b.department);
    }
    return a.empCode.localeCompare(b.empCode, undefined, { numeric: true });
  });

  return sortedEmployees.map((employee) => {
    const days: Record<string, 0 | 1 | 2> = {};
    let totalShifts = 0;

    for (const dStr of allDays) {
      const key = `${employee.empCode}|${dStr}`;
      const times = punchesByEmpDate.get(key);

      if (!times || times.length === 0) {
        days[dStr] = 0;
        continue;
      }

      const sortedTimes = [...times].sort((a, b) => a - b);
      let shiftVal: 1 | 2 = 1;

      if (deviceCategory === "STAFF_GATE") {
        const spanMinutes = Math.round(
          (sortedTimes[sortedTimes.length - 1] - sortedTimes[0]) / 60000
        );
        const scheduledShifts = shiftCountsByEmpDate[key] || 0;

        // Double shift if worked >= 13h back-to-back OR scheduled for 2 shifts and worked >= 9h
        if (
          spanMinutes >= 780 ||
          (scheduledShifts >= 2 && spanMinutes >= 540)
        ) {
          shiftVal = 2;
        }
      } else {
        // Canteen Device: count distinct meal punches separated by >= 3 hours (180 mins)
        let distinctMealShifts = 1;
        let lastClusterTime = sortedTimes[0];
        for (let i = 1; i < sortedTimes.length; i++) {
          if (sortedTimes[i] - lastClusterTime >= 180 * 60000) {
            distinctMealShifts++;
            lastClusterTime = sortedTimes[i];
          }
        }
        if (distinctMealShifts >= 2) {
          shiftVal = 2;
        }
      }

      days[dStr] = shiftVal;
      totalShifts += shiftVal;
    }

    return {
      employee,
      days,
      totalShifts,
      totalHours: totalShifts * 8,
    };
  });
}

export function PunchesClient({
  punches,
  timesheetPunches,
  timesheetStartDate,
  timesheetEndDate,
  shiftCountsByEmpDate,
  scopedEmployees,
  departmentLabel,
  preparedBy,
}: PunchesClientProps) {
  const [activeTab, setActiveTab] = useState<"STAFF_GATE" | "CANTEEN" | "SPLIT">(
    "STAFF_GATE"
  );
  const [gateViewMode, setGateViewMode] = useState<
    "SUMMARY" | "TIMESHEET" | "RAW"
  >("SUMMARY");
  const [canteenViewMode, setCanteenViewMode] = useState<"RAW" | "TIMESHEET">(
    "RAW"
  );

  const staffGatePunches = useMemo(
    () => punches.filter((p) => p.deviceCategory === "STAFF_GATE"),
    [punches]
  );

  const canteenPunches = useMemo(
    () => punches.filter((p) => p.deviceCategory === "CANTEEN"),
    [punches]
  );

  const tsGatePunches = useMemo(
    () => timesheetPunches.filter((p) => p.deviceCategory === "STAFF_GATE"),
    [timesheetPunches]
  );

  const tsCanteenPunches = useMemo(
    () => timesheetPunches.filter((p) => p.deviceCategory === "CANTEEN"),
    [timesheetPunches]
  );

  const gateTimesheetRows = useMemo(
    () =>
      buildTimesheetRows(
        tsGatePunches,
        "STAFF_GATE",
        timesheetStartDate,
        timesheetEndDate,
        shiftCountsByEmpDate,
        scopedEmployees
      ),
    [
      tsGatePunches,
      timesheetStartDate,
      timesheetEndDate,
      shiftCountsByEmpDate,
      scopedEmployees,
    ]
  );

  const canteenTimesheetRows = useMemo(
    () =>
      buildTimesheetRows(
        tsCanteenPunches,
        "CANTEEN",
        timesheetStartDate,
        timesheetEndDate,
        shiftCountsByEmpDate,
        scopedEmployees
      ),
    [
      tsCanteenPunches,
      timesheetStartDate,
      timesheetEndDate,
      shiftCountsByEmpDate,
      scopedEmployees,
    ]
  );

  const dateColumns = useMemo(() => {
    const s = new Date(`${timesheetStartDate}T00:00:00`);
    const e = new Date(`${timesheetEndDate}T00:00:00`);
    return eachDayOfInterval({
      start: s <= e ? s : e,
      end: e >= s ? e : s,
    }).map((d) => {
      const dow = d.getDay();
      return {
        dateStr: format(d, "yyyy-MM-dd"),
        dowLabel: DOW_SHORT[dow] || "",
        dayNum: d.getDate(),
        isWeekend: dow === 0 || dow === 6,
      };
    });
  }, [timesheetStartDate, timesheetEndDate]);

  // Group Staff Gate punches by (empCode + date) for First-In / Last-Out summary
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

    const sorted = [...staffGatePunches].sort(
      (a, b) => new Date(a.punchTime).getTime() - new Date(b.punchTime).getTime()
    );

    for (const p of sorted) {
      const dateStr = format(new Date(p.punchTime), "yyyy-MM-dd");
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

  const resolveDeptHeader = (rows: TimesheetRow[]) => {
    if (departmentLabel && departmentLabel !== "All Departments") {
      return departmentLabel;
    }
    const uniqueDepts = Array.from(
      new Set(
        rows
          .map((r) => r.employee.department)
          .filter((d) => d && d !== "—")
      )
    );
    return uniqueDepts.length === 1 ? uniqueDepts[0] : "All Departments";
  };

  const handleExportExcel = (device: "STAFF_GATE" | "CANTEEN") => {
    const rows =
      device === "STAFF_GATE" ? gateTimesheetRows : canteenTimesheetRows;
    exportTimesheetExcel({
      departmentLabel: resolveDeptHeader(rows),
      startDate: timesheetStartDate,
      endDate: timesheetEndDate,
      rows,
      preparedBy,
      subtitleNote:
        device === "STAFF_GATE"
          ? "Staff Gate Attendance"
          : "Canteen Meal Punches",
      filePrefix:
        device === "STAFF_GATE"
          ? "FT_Time_Sheet_Staff_Gate"
          : "FT_Time_Sheet_Canteen",
    });
  };

  const handleExportPDF = (device: "STAFF_GATE" | "CANTEEN") => {
    const rows =
      device === "STAFF_GATE" ? gateTimesheetRows : canteenTimesheetRows;
    exportTimesheetPDF({
      departmentLabel: resolveDeptHeader(rows),
      startDate: timesheetStartDate,
      endDate: timesheetEndDate,
      rows,
      preparedBy,
      subtitleNote:
        device === "STAFF_GATE"
          ? "Staff Gate Attendance"
          : "Canteen Meal Punches",
    });
  };

  const renderTimesheetPreview = (rows: TimesheetRow[], emptyMsg: string) => {
    if (rows.length === 0) {
      return (
        <div className="py-12 text-center text-muted-foreground text-sm">
          {emptyMsg}
        </div>
      );
    }
    const grandTotalShifts = rows.reduce((s, r) => s + r.totalShifts, 0);
    const grandTotalHours = rows.reduce((s, r) => s + r.totalHours, 0);

    return (
      <div className="p-4 bg-[#dcdcdc]/60 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-white/90 px-4 py-2.5 rounded-xl border border-gray-300 text-xs">
          <div className="font-bold text-gray-900">
            Four Points by Sheraton Lagos — FT Associate Time Sheet (
            <span className="text-red-700">{resolveDeptHeader(rows)}</span>)
          </div>
          <div className="flex items-center gap-4 font-semibold">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-5 text-center bg-[#FFFF00] border border-gray-400 font-bold">
                ✓
              </span>{" "}
              = 8 Hours (1 Shift)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-6 text-center bg-[#FFFF00] border border-gray-400 font-bold">
                ✓✓
              </span>{" "}
              = 16 Hours (Double Shift)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-5 text-center bg-[#BFBFBF] border border-gray-400">
                0
              </span>{" "}
              = 0 Hours
            </span>
          </div>
        </div>

        <div className="overflow-x-auto border border-black bg-white shadow-xs">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                <th
                  rowSpan={3}
                  className="bg-[#FFC000] border border-black px-2 py-1 text-center font-bold"
                >
                  ID No.
                </th>
                <th
                  rowSpan={3}
                  className="bg-[#FFC000] border border-black px-2 py-1 text-center font-bold"
                >
                  Dept
                </th>
                <th
                  colSpan={2}
                  rowSpan={2}
                  className="bg-[#FFC000] border border-black px-2 py-1 text-center font-bold"
                >
                  Name
                </th>
                <th
                  colSpan={dateColumns.length}
                  className="bg-[#FFC000] border border-black px-2 py-1 text-center font-bold text-[#C00000]"
                >
                  Shift Attendance Record: ✓ = 8 Hours (1 Shift), ✓✓ = 16 Hours
                  (Double Shift), &quot;0&quot; = 0 Hours
                </th>
                <th
                  colSpan={2}
                  rowSpan={2}
                  className="bg-[#FFC000] border border-black px-2.5 py-1 text-center font-bold"
                >
                  Totals
                </th>
              </tr>
              <tr>
                {dateColumns.map((c) => (
                  <th
                    key={`dow-${c.dateStr}`}
                    className="bg-[#FFC000] border-x border-gray-600 px-1 py-0.5 text-center font-bold text-[10px]"
                  >
                    {c.dowLabel}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="bg-[#FFC000] border border-black px-2 py-1 text-left font-semibold">
                  Surname
                </th>
                <th className="bg-[#FFC000] border border-black px-2 py-1 text-left font-semibold">
                  Given Names
                </th>
                {dateColumns.map((c) => (
                  <th
                    key={`num-${c.dateStr}`}
                    className={`${
                      c.isWeekend ? "bg-[#BFBFBF]" : "bg-[#FFC000]"
                    } border border-gray-700 px-1 py-0.5 text-center font-bold text-[10px] min-w-[24px]`}
                  >
                    {c.dayNum}
                  </th>
                ))}
                <th className="bg-[#F4B084] border border-black px-2 py-1 text-center font-bold text-[10px] whitespace-nowrap">
                  Total Shifts
                </th>
                <th className="bg-[#ED7D31] border border-black px-2 py-1 text-center font-bold text-[10px] whitespace-nowrap">
                  Hours Worked
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.employee.empCode}>
                  <td className="bg-[#92D050] border border-gray-500 px-2 py-1 text-center font-bold">
                    {row.employee.empCode}
                  </td>
                  <td className="bg-white border border-gray-400 px-2 py-1 whitespace-nowrap">
                    {row.employee.department}
                  </td>
                  <td className="bg-white border border-gray-400 px-2 py-1 whitespace-nowrap font-medium">
                    {row.employee.surname}
                  </td>
                  <td className="bg-white border border-gray-400 px-2 py-1 whitespace-nowrap">
                    {row.employee.givenNames}
                  </td>
                  {dateColumns.map((c) => {
                    const val = row.days[c.dateStr] ?? 0;
                    return (
                      <td
                        key={`${row.employee.empCode}-${c.dateStr}`}
                        className={`border border-gray-400 px-1 py-1 text-center ${
                          val > 0
                            ? "bg-[#FFFF00] font-bold text-black"
                            : "bg-[#BFBFBF] text-gray-800"
                        }`}
                      >
                        {val === 2 ? "✓✓" : val === 1 ? "✓" : "0"}
                      </td>
                    );
                  })}
                  <td className="bg-[#FCE4D6] border border-black px-2 py-1 text-center font-bold">
                    {row.totalShifts}
                  </td>
                  <td className="bg-[#F8CBAD] border border-black px-2 py-1 text-center font-extrabold">
                    {row.totalHours}
                  </td>
                </tr>
              ))}
              <tr>
                <td
                  colSpan={4 + dateColumns.length}
                  className="bg-gray-100 border-t border-black px-3 py-1.5 text-right font-bold text-xs"
                >
                  Grand Totals:
                </td>
                <td className="bg-[#FFC000] border-2 border-black px-2 py-1.5 text-center font-extrabold text-sm">
                  {grandTotalShifts}
                </td>
                <td className="bg-[#FFC000] border-2 border-black px-2 py-1.5 text-center font-extrabold text-sm">
                  {grandTotalHours}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
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
                  Daily In/Out ({gateDailySummaries.length})
                </button>
                <button
                  type="button"
                  onClick={() => setGateViewMode("TIMESHEET")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1 transition-colors ${
                    gateViewMode === "TIMESHEET"
                      ? "bg-amber-100 text-amber-900"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Grid3X3 className="w-3.5 h-3.5" />
                  Time Sheet (✓ / ✓✓ / 0)
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

            {activeTab === "CANTEEN" && (
              <div className="inline-flex rounded-lg border border-border bg-white p-0.5 mr-2">
                <button
                  type="button"
                  onClick={() => setCanteenViewMode("RAW")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    canteenViewMode === "RAW"
                      ? "bg-amber-50 text-amber-800"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Meal Log ({canteenPunches.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCanteenViewMode("TIMESHEET")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1 transition-colors ${
                    canteenViewMode === "TIMESHEET"
                      ? "bg-amber-100 text-amber-900"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Grid3X3 className="w-3.5 h-3.5" />
                  Time Sheet (✓ / ✓✓ / 0)
                </button>
              </div>
            )}

            {activeTab !== "CANTEEN" && (
              <>
                <button
                  type="button"
                  onClick={() => handleExportExcel("STAFF_GATE")}
                  className="btn-outline btn-sm text-xs flex items-center gap-1.5"
                  title="Download Four Points FT Associate Time Sheet (.xls)"
                >
                  <Table className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Staff Gate Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportPDF("STAFF_GATE")}
                  className="btn-outline btn-sm text-xs flex items-center gap-1.5"
                  title="Print / Save Four Points FT Associate Time Sheet as PDF"
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
                  onClick={() => handleExportExcel("CANTEEN")}
                  className="btn-outline btn-sm text-xs flex items-center gap-1.5"
                  title="Download Four Points FT Associate Time Sheet (.xls)"
                >
                  <Table className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Canteen Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportPDF("CANTEEN")}
                  className="btn-outline btn-sm text-xs flex items-center gap-1.5"
                  title="Print / Save Four Points FT Associate Time Sheet as PDF"
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
            {gateViewMode === "TIMESHEET" ? (
              renderTimesheetPreview(
                gateTimesheetRows,
                "No Staff Gate records found for the selected filter."
              )
            ) : staffGatePunches.length === 0 ? (
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
                        {format(new Date(`${s.dateStr}T00:00:00`), "EEE, dd MMM yyyy")}
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
            {canteenViewMode === "TIMESHEET" ? (
              renderTimesheetPreview(
                canteenTimesheetRows,
                "No Canteen Device records found for the selected filter."
              )
            ) : canteenPunches.length === 0 ? (
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
