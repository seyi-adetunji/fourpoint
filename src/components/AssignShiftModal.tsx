"use client";

import { useState, useEffect, useMemo, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  CalendarIcon,
  Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  empCode: string;
  fullName: string;
  department?: { name: string } | null;
}

interface ShiftTemplate {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  color?: string;
}

interface ExistingAssignment {
  workDate: string; // ISO date string
  shiftTemplate: { name: string; color?: string };
  employeeId: string;
  sequence: number;
}

interface AssignShiftModalProps {
  employees: Employee[];
  /** When true (HOD), assignments are created with PENDING_APPROVAL status */
  requiresApproval?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay(); // 0=Sun
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Component ────────────────────────────────────────────────────────────────

export default function AssignShiftModal({ employees, requiresApproval = false }: AssignShiftModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // ── Data state
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [assignments, setAssignments] = useState<ExistingAssignment[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // ── Selection state
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());

  // ── Calendar state
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  // ── Pagination / search
  const [empPage, setEmpPage] = useState(1);
  const [tplPage, setTplPage] = useState(1);
  const [empSearch, setEmpSearch] = useState("");
  const [tplSearch, setTplSearch] = useState("");

  // ── Feedback
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ── Load templates + existing assignments when modal opens
  useEffect(() => {
    if (!open) return;
    setLoadingTemplates(true);
    Promise.all([
      fetch("/api/shifts").then((r) => r.json()),
      fetch(`/api/shifts/month?year=${calYear}&month=${calMonth + 1}`).then((r) =>
        r.ok ? r.json() : []
      ),
    ])
      .then(([tpls, assigns]) => {
        setTemplates(tpls);
        setAssignments(assigns);
      })
      .catch(() => setError("Failed to load data."))
      .finally(() => setLoadingTemplates(false));
  }, [open, calYear, calMonth]);

  // ── Refetch assignments when month changes (modal already open)
  const refetchAssignments = useCallback(async () => {
    try {
      const res = await fetch(`/api/shifts/month?year=${calYear}&month=${calMonth + 1}`);
      if (res.ok) setAssignments(await res.json());
    } catch {
      // silent
    }
  }, [calYear, calMonth]);

  useEffect(() => {
    if (!open) return;
    refetchAssignments();
  }, [calYear, calMonth, open, refetchAssignments]);

  // ── Filtered / paginated employees
  const filteredEmployees = useMemo(() => {
    const q = empSearch.toLowerCase();
    return employees.filter(
      (e) =>
        e.fullName.toLowerCase().includes(q) ||
        e.empCode.toLowerCase().includes(q)
    );
  }, [employees, empSearch]);

  const empTotalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const pagedEmployees = filteredEmployees.slice(
    (empPage - 1) * PAGE_SIZE,
    empPage * PAGE_SIZE
  );

  // ── Filtered / paginated templates
  const filteredTemplates = useMemo(() => {
    const q = tplSearch.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q)
    );
  }, [templates, tplSearch]);

  const tplTotalPages = Math.max(1, Math.ceil(filteredTemplates.length / PAGE_SIZE));
  const pagedTemplates = filteredTemplates.slice(
    (tplPage - 1) * PAGE_SIZE,
    tplPage * PAGE_SIZE
  );

  // ── Calendar grid
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);

  // Build a map: date -> assignments
  const assignmentMap = useMemo(() => {
    const map = new Map<string, ExistingAssignment[]>();
    for (const a of assignments) {
      const key = a.workDate.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return map;
  }, [assignments]);

  const todayIso = isoDate(today.getFullYear(), today.getMonth(), today.getDate());

  // ── Toggle helpers
  const toggleEmployee = (id: string) => {
    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllEmployees = () => {
    const allIds = pagedEmployees.map((e) => e.id);
    const allSelected = allIds.every((id) => selectedEmployeeIds.has(id));
    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev);
      if (allSelected) allIds.forEach((id) => next.delete(id));
      else allIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleTemplate = (id: string) => {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllTemplates = () => {
    const allIds = pagedTemplates.map((t) => t.id);
    const allSelected = allIds.every((id) => selectedTemplateIds.has(id));
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev);
      if (allSelected) allIds.forEach((id) => next.delete(id));
      else allIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleDate = (dateStr: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  };

  // ── Calendar navigation
  const prevMonth = () => {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else setCalMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
    else setCalMonth((m) => m + 1);
  };
  const goToday = () => {
    setCalYear(today.getFullYear());
    setCalMonth(today.getMonth());
  };

  // ── Open / Close
  const handleOpen = () => {
    setOpen(true);
    setError(null);
    setSuccessMsg(null);
    setSelectedEmployeeIds(new Set());
    setSelectedTemplateIds(new Set());
    setSelectedDates(new Set());
    setEmpSearch("");
    setTplSearch("");
    setEmpPage(1);
    setTplPage(1);
    setCalYear(today.getFullYear());
    setCalMonth(today.getMonth());
  };

  const handleClose = () => {
    if (isPending) return;
    setOpen(false);
  };

  // ── Submit
  const handleConfirm = () => {
    setError(null);
    if (selectedEmployeeIds.size === 0) { setError("Select at least one employee."); return; }
    if (selectedTemplateIds.size === 0) { setError("Select at least one shift template."); return; }
    if (selectedDates.size === 0) { setError("Select at least one date on the calendar."); return; }

    startTransition(async () => {
      try {
        const res = await fetch("/api/shifts/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeIds: Array.from(selectedEmployeeIds),
            shiftTemplateIds: Array.from(selectedTemplateIds),
            dates: Array.from(selectedDates),
            status: requiresApproval ? "PENDING_APPROVAL" : "SCHEDULED",
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.message || "Failed to assign shifts.");
          return;
        }

        setSuccessMsg(`✓ ${data.created} shift(s) assigned successfully.`);
        await refetchAssignments();
        setTimeout(() => {
          setOpen(false);
          router.refresh();
        }, 1400);
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  };

  // ── Build calendar grid rows
  const calendarCells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // pad to full weeks
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < calendarCells.length; i += 7) {
    weeks.push(calendarCells.slice(i, i + 7));
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium shadow-sm"
      >
        <CalendarIcon className="w-4 h-4" />
        Assign Shift
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          {/* Modal Panel */}
          <div
            className="relative bg-white rounded-xl shadow-2xl w-full max-w-[1100px] max-h-[92vh] flex flex-col z-50 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ fontFamily: "Inter, system-ui, sans-serif" }}
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0">
              <h2 className="text-base font-semibold text-gray-800">Add Temporary Schedule</h2>
              <button
                onClick={handleClose}
                className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ── Body ── */}
            <div className="flex flex-1 overflow-hidden min-h-0">

              {/* ── LEFT: Employee Panel ── */}
              <div className="w-[220px] shrink-0 border-r border-gray-200 flex flex-col bg-white">
                {/* Panel top bar */}
                <div className="px-3 py-2 border-b border-gray-100 shrink-0">
                  {/* Dropdown-style label */}
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded px-2 py-0.5">Employee ▾</span>
                  </div>
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Employee"
                      value={empSearch}
                      onChange={(e) => { setEmpSearch(e.target.value); setEmpPage(1); }}
                      className="w-full pl-6 pr-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                </div>

                {/* Table header */}
                <div className="grid grid-cols-[20px_1fr_1fr] gap-1 px-3 py-1.5 bg-gray-50 border-b border-gray-200 shrink-0">
                  <input
                    type="checkbox"
                    checked={pagedEmployees.length > 0 && pagedEmployees.every((e) => selectedEmployeeIds.has(e.id))}
                    onChange={toggleAllEmployees}
                    className="accent-blue-600 w-3.5 h-3.5"
                  />
                  <span className="text-[10px] font-semibold text-gray-500 uppercase">Emp ID</span>
                  <span className="text-[10px] font-semibold text-gray-500 uppercase">First Name</span>
                </div>

                {/* Employee rows */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  {pagedEmployees.map((emp) => (
                    <div
                      key={emp.id}
                      onClick={() => toggleEmployee(emp.id)}
                      className={`grid grid-cols-[20px_1fr_1fr] gap-1 px-3 py-1.5 cursor-pointer border-b border-gray-100 hover:bg-blue-50 transition-colors ${selectedEmployeeIds.has(emp.id) ? "bg-blue-50" : ""}`}
                    >
                      <input
                        type="checkbox"
                        readOnly
                        checked={selectedEmployeeIds.has(emp.id)}
                        className="accent-blue-600 w-3.5 h-3.5 pointer-events-none"
                      />
                      <span className="text-xs text-gray-700 truncate">{emp.empCode}</span>
                      <span className="text-xs text-gray-700 truncate">{emp.fullName.split(" ")[0]}</span>
                    </div>
                  ))}
                  {pagedEmployees.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-6">No employees found</p>
                  )}
                </div>

                {/* Pagination */}
                <BottomPagination
                  page={empPage}
                  totalPages={empTotalPages}
                  totalRecords={filteredEmployees.length}
                  pageSize={PAGE_SIZE}
                  onPage={setEmpPage}
                />
              </div>

              {/* ── CENTER: Calendar Panel ── */}
              <div className="flex-1 flex flex-col min-w-0 bg-white">
                {/* Calendar nav */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
                  <h3 className="text-2xl font-light text-gray-800">
                    {MONTH_NAMES[calMonth]} {calYear}
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={goToday}
                      className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
                    >
                      Today
                    </button>
                    <button
                      onClick={prevMonth}
                      className="p-1 rounded hover:bg-gray-100 text-gray-600"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={nextMonth}
                      className="p-1 rounded hover:bg-gray-100 text-gray-600"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-gray-200 shrink-0">
                  {DAY_HEADERS.map((d) => (
                    <div key={d} className="py-1.5 text-center text-[11px] font-medium text-gray-500">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  {loadingTemplates ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-7 h-full" style={{ gridAutoRows: `minmax(${Math.max(64, Math.floor(100 / weeks.length))}px, 1fr)` }}>
                      {weeks.map((week, wi) =>
                        week.map((day, di) => {
                          if (!day) {
                            return (
                              <div
                                key={`empty-${wi}-${di}`}
                                className="border-b border-r border-gray-100 bg-gray-50/40"
                              />
                            );
                          }
                          const dateStr = isoDate(calYear, calMonth, day);
                          const isToday = dateStr === todayIso;
                          const isSelected = selectedDates.has(dateStr);
                          const dayAssigns = assignmentMap.get(dateStr) || [];

                          // Only show assignments relevant to selected employees (or all if none selected)
                          const relevantAssigns = selectedEmployeeIds.size > 0
                            ? dayAssigns.filter((a) => selectedEmployeeIds.has(a.employeeId))
                            : dayAssigns;

                          // Deduplicate showing: keep the top 3 chips, collapse rest
                          const maxChips = 3;
                          const visibleAssigns = relevantAssigns.slice(0, maxChips);
                          const overflowCount = relevantAssigns.length - maxChips;

                          return (
                            <div
                              key={dateStr}
                              onClick={() => toggleDate(dateStr)}
                              className={`border-b border-r border-gray-100 p-1 cursor-pointer transition-colors relative
                                ${isSelected ? "ring-2 ring-inset ring-amber-400 bg-amber-50/70" : "hover:bg-gray-50"}
                                ${isToday && !isSelected ? "bg-blue-50/40" : ""}`}
                            >
                              {/* Day number */}
                              <span
                                className={`text-[11px] font-semibold leading-none ${
                                  isToday ? "text-blue-600" : "text-gray-500"
                                }`}
                              >
                                {day}
                              </span>

                              {/* Shift chips — each shows seq badge + name */}
                              <div className="mt-0.5 space-y-[2px]">
                                {visibleAssigns.map((a) => {
                                  const chipColor = a.shiftTemplate.color || "#6B7280";
                                  const label = a.shiftTemplate.name.length > 10
                                    ? a.shiftTemplate.name.slice(0, 10) + "…"
                                    : a.shiftTemplate.name;
                                  return (
                                    <div
                                      key={`${a.employeeId}-${a.sequence}`}
                                      className="flex items-center gap-0.5 rounded overflow-hidden text-white"
                                      style={{ backgroundColor: chipColor }}
                                      title={`Seq ${a.sequence}: ${a.shiftTemplate.name}`}
                                    >
                                      {/* Sequence badge */}
                                      <span
                                        className="shrink-0 text-[8px] font-bold px-0.5 leading-tight opacity-90"
                                        style={{ backgroundColor: "rgba(0,0,0,0.18)" }}
                                      >
                                        {a.sequence}
                                      </span>
                                      <span className="text-[9px] font-medium leading-tight px-0.5 truncate">
                                        {label}
                                      </span>
                                    </div>
                                  );
                                })}
                                {overflowCount > 0 && (
                                  <div className="text-[9px] text-gray-400 pl-0.5">
                                    +{overflowCount} more
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── RIGHT: Timetable Panel ── */}
              <div className="w-[280px] shrink-0 border-l border-gray-200 flex flex-col bg-white">
                {/* Search */}
                <div className="px-3 py-2 border-b border-gray-100 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Timetable"
                      value={tplSearch}
                      onChange={(e) => { setTplSearch(e.target.value); setTplPage(1); }}
                      className="w-full pl-6 pr-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                </div>

                {/* Table header */}
                <div className="grid grid-cols-[20px_1fr_60px_60px] gap-1 px-3 py-1.5 bg-gray-50 border-b border-gray-200 shrink-0">
                  <input
                    type="checkbox"
                    checked={pagedTemplates.length > 0 && pagedTemplates.every((t) => selectedTemplateIds.has(t.id))}
                    onChange={toggleAllTemplates}
                    className="accent-blue-600 w-3.5 h-3.5"
                  />
                  <span className="text-[10px] font-semibold text-gray-500 uppercase">Name</span>
                  <span className="text-[10px] font-semibold text-gray-500 uppercase">Check-In</span>
                  <span className="text-[10px] font-semibold text-gray-500 uppercase">Check-O…</span>
                </div>

                {/* Template rows */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  {loadingTemplates ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    pagedTemplates.map((tpl) => {
                      const chipColor = tpl.color || "#6B7280";
                      return (
                        <div
                          key={tpl.id}
                          onClick={() => toggleTemplate(tpl.id)}
                          className={`grid grid-cols-[20px_1fr_60px_60px] gap-1 px-3 py-2 cursor-pointer border-b border-gray-100 hover:bg-blue-50 transition-colors ${selectedTemplateIds.has(tpl.id) ? "bg-blue-50" : ""}`}
                        >
                          <input
                            type="checkbox"
                            readOnly
                            checked={selectedTemplateIds.has(tpl.id)}
                            className="accent-blue-600 w-3.5 h-3.5 pointer-events-none"
                          />
                          <div className="flex items-center gap-1 min-w-0">
                            {/* Color dot */}
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: chipColor }}
                            />
                            <span className="text-xs text-gray-700 truncate">{tpl.name}</span>
                          </div>
                          <span className="text-xs text-gray-600 tabular-nums">{tpl.startTime}</span>
                          <span className="text-xs text-gray-600 tabular-nums">{tpl.endTime}</span>
                        </div>
                      );
                    })
                  )}
                  {!loadingTemplates && pagedTemplates.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-6">No shift templates found</p>
                  )}
                </div>

                {/* Pagination */}
                <BottomPagination
                  page={tplPage}
                  totalPages={tplTotalPages}
                  totalRecords={filteredTemplates.length}
                  pageSize={PAGE_SIZE}
                  onPage={setTplPage}
                />
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-3 flex items-center justify-between">
              {/* Selection summary */}
              <div className="text-xs text-gray-500 space-x-3">
                {selectedEmployeeIds.size > 0 && (
                  <span>{selectedEmployeeIds.size} employee{selectedEmployeeIds.size > 1 ? "s" : ""}</span>
                )}
                {selectedDates.size > 0 && (
                  <span>{selectedDates.size} date{selectedDates.size > 1 ? "s" : ""}</span>
                )}
                {selectedTemplateIds.size > 0 && (
                  <span>{selectedTemplateIds.size} shift{selectedTemplateIds.size > 1 ? "s" : ""}</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* Error / success inline */}
                {error && <span className="text-xs text-red-600">{error}</span>}
                {successMsg && <span className="text-xs text-green-600">{successMsg}</span>}

                <button
                  onClick={handleClose}
                  disabled={isPending}
                  className="px-4 py-1.5 text-sm border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isPending}
                  className="flex items-center gap-2 px-5 py-1.5 text-sm font-medium bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-60"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── BottomPagination sub-component ──────────────────────────────────────────

function BottomPagination({
  page,
  totalPages,
  totalRecords,
  pageSize,
  onPage,
}: {
  page: number;
  totalPages: number;
  totalRecords: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  return (
    <div className="shrink-0 border-t border-gray-100 px-3 py-1.5 flex items-center gap-1 bg-white text-[10px] text-gray-500">
      {/* Page size indicator */}
      <span className="border border-gray-300 rounded px-1.5 py-0.5 bg-white">{pageSize}</span>
      <button
        onClick={() => onPage(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-30"
      >
        <ChevronLeft className="w-3 h-3" />
      </button>
      <span className="border border-gray-300 rounded px-1.5 py-0.5 bg-white font-medium text-gray-700 min-w-[20px] text-center">
        {page}
      </span>
      <button
        onClick={() => onPage(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-30"
      >
        <ChevronRight className="w-3 h-3" />
      </button>
      <span>{totalPages}</span>
      <span className="ml-auto">Total {totalRecords} Record{totalRecords !== 1 ? "s" : ""}</span>
    </div>
  );
}
