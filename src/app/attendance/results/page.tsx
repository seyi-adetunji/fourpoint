import prisma from "@/lib/prisma";
export const dynamic = "force-dynamic";
import { format, subDays } from "date-fns";
import { getUTCMidnight } from "@/lib/dateUtils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ExportButtons } from "@/components/ExportButtons";
import { syncAttendanceResultsForRange } from "@/lib/attendanceProcessor";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Users,
  Search,
} from "lucide-react";

export default async function AttendanceResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role ?? "EMPLOYEE";
  const userDeptId = (session?.user as any)?.departmentId as number | null;

  const isDeptScoped = ["HOD", "DEPT_ADMIN", "SUPERVISOR"].includes(userRole);

  const dateStr = params?.date as string | undefined;
  const endDateStr = params?.endDate as string | undefined;
  const statusFilter = params?.status as string | undefined;
  const q = (params?.q as string | undefined)?.trim() || "";
  const deptId = isDeptScoped
    ? userDeptId
      ? String(userDeptId)
      : undefined
    : (params?.department as string | undefined);

  // Determine date range: if no date param is supplied, check if today has activity;
  // if not, default to a window covering the most recent biometric punches / shifts.
  let startDate: Date;
  let endDate: Date;

  if (dateStr) {
    startDate = getUTCMidnight(dateStr);
    endDate = endDateStr ? getUTCMidnight(endDateStr) : startDate;
  } else {
    const today = getUTCMidnight();
    const [latestPunch, latestShift] = await Promise.all([
      prisma.iclockTransaction.findFirst({
        orderBy: { punchTime: "desc" },
        select: { punchTime: true },
      }),
      prisma.shiftAssignment.findFirst({
        where: { workDate: { lte: today }, status: { not: "CANCELLED" } },
        orderBy: { workDate: "desc" },
        select: { workDate: true },
      }),
    ]);

    const latestPunchDate = latestPunch
      ? getUTCMidnight(latestPunch.punchTime.toISOString().slice(0, 10))
      : null;
    const latestShiftDate = latestShift
      ? getUTCMidnight(latestShift.workDate.toISOString().slice(0, 10))
      : null;

    const anchorDate =
      latestPunchDate && latestShiftDate
        ? latestPunchDate > latestShiftDate
          ? latestPunchDate
          : latestShiftDate
        : latestPunchDate || latestShiftDate || today;

    // Sync and show a 30-day window up to the latest active date so results are visible immediately
    endDate = anchorDate > today ? anchorDate : today;
    startDate = getUTCMidnight(subDays(anchorDate, 30).toISOString().slice(0, 10));
  }

  // Automatically process / sync attendance results from Staff Gate punches + ShiftAssignments
  await syncAttendanceResultsForRange(startDate, endDate);

  const [departments, results] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.attendanceResult.findMany({
      where: {
        workDate: { gte: startDate, lte: endDate },
        employee: {
          ...(deptId ? { departmentId: Number(deptId) } : {}),
          ...(q
            ? {
                OR: [
                  { fullName: { contains: q, mode: "insensitive" } },
                  { empCode: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      include: {
        employee: { include: { department: true } },
        shiftTemplate: true,
      },
      orderBy: [
        { workDate: "desc" },
        { employee: { fullName: "asc" } },
        { sequence: "asc" },
      ],
      take: 1000,
    }),
  ]);

  const statuses = [
    "PRESENT",
    "LATE",
    "EARLY_EXIT",
    "LATE_AND_EARLY",
    "MISSING_PUNCH",
    "ABSENT",
  ];

  const presentCount = results.filter((r) => r.status === "PRESENT").length;
  const lateOrEarlyCount = results.filter((r) =>
    ["LATE", "EARLY_EXIT", "LATE_AND_EARLY"].includes(r.status)
  ).length;
  const missingPunchCount = results.filter(
    (r) => r.status === "MISSING_PUNCH"
  ).length;
  const absentCount = results.filter((r) =>
    ["ABSENT", "NO_SHOW"].includes(r.status)
  ).length;

  const exportData = results.map((r) => ({
    date: format(r.workDate, "yyyy-MM-dd"),
    employee: r.employee.fullName,
    empCode: r.employee.empCode,
    department: r.employee.department?.name || "—",
    shift: r.shiftTemplate?.name || "—",
    clockIn: r.actualIn ? format(r.actualIn, "HH:mm") : "—",
    clockOut: r.actualOut ? format(r.actualOut, "HH:mm") : "—",
    workedHours: r.workedMinutes > 0 ? `${(r.workedMinutes / 60).toFixed(1)}h` : "0h",
    overtime: r.overtimeMinutes > 0 ? `${r.overtimeMinutes}m` : "0m",
    status: r.status,
    remarks: r.remarks || "—",
  }));

  const exportHeaders = [
    { label: "Work Date", key: "date" },
    { label: "Employee", key: "employee" },
    { label: "Staff ID", key: "empCode" },
    { label: "Department", key: "department" },
    { label: "Shift", key: "shift" },
    { label: "Clock In (Staff Gate)", key: "clockIn" },
    { label: "Clock Out (Staff Gate)", key: "clockOut" },
    { label: "Worked Hours", key: "workedHours" },
    { label: "Overtime", key: "overtime" },
    { label: "Status", key: "status" },
    { label: "Remarks", key: "remarks" },
  ];

  return (
    <div className="page-container animate-fade-in space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Results</h1>
          <p className="page-subtitle">
            Processed attendance from Staff Gate biometric clock-ins &amp; scheduled shifts (
            {format(startDate, "dd MMM yyyy")}
            {startDate.getTime() !== endDate.getTime()
              ? ` – ${format(endDate, "dd MMM yyyy")}`
              : ""}
            )
          </p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Total Records</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{results.length}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
            <Users className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Present</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{presentCount}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Late / Early</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{lateOrEarlyCount}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Missing Out Punch</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">{missingPunchCount}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Absent</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{absentCount}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-red-50 text-red-600">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <form className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                name="date"
                defaultValue={format(startDate, "yyyy-MM-dd")}
                className="input max-w-[145px]"
              />
              <span className="text-gray-400 text-xs">to</span>
              <input
                type="date"
                name="endDate"
                defaultValue={format(endDate, "yyyy-MM-dd")}
                className="input max-w-[145px]"
              />
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Search employee or ID..."
                className="input pl-9 max-w-[190px]"
              />
            </div>

            {isDeptScoped ? (
              <span className="text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-3 py-2 rounded-xl">
                📍 {departments.find((d) => d.id === userDeptId)?.name ?? "Your Department"}
              </span>
            ) : (
              <select
                name="department"
                defaultValue={deptId || ""}
                className="input max-w-[180px]"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
            <select
              name="status"
              defaultValue={statusFilter || ""}
              className="input max-w-[170px]"
            >
              <option value="">All Statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-primary btn-sm">
              Filter &amp; Sync
            </button>
            <a href="/attendance/results" className="btn-secondary btn-sm">
              Reset
            </a>
          </form>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {results.length} records
            </span>
            <ExportButtons
              data={exportData}
              filename="attendance_results"
              headers={exportHeaders}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-gray-50/30">
              <tr>
                <th className="px-5 py-3.5 text-left font-semibold">Date</th>
                <th className="px-5 py-3.5 text-left font-semibold">Employee</th>
                <th className="px-5 py-3.5 text-left font-semibold">Department</th>
                <th className="px-5 py-3.5 text-left font-semibold">Shift</th>
                <th className="px-5 py-3.5 text-left font-semibold">Gate In</th>
                <th className="px-5 py-3.5 text-left font-semibold">Gate Out</th>
                <th className="px-5 py-3.5 text-left font-semibold">Worked</th>
                <th className="px-5 py-3.5 text-left font-semibold">OT</th>
                <th className="px-5 py-3.5 text-left font-semibold">Status</th>
                <th className="px-5 py-3.5 text-left font-semibold">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {results.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-5 py-12 text-center text-muted-foreground"
                  >
                    No attendance records found for the selected filter.
                  </td>
                </tr>
              ) : (
                results.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-5 py-3.5 font-medium whitespace-nowrap text-gray-700">
                      {format(r.workDate, "EEE, dd MMM yyyy")}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-gray-900">
                        {r.employee.fullName}
                      </div>
                      <div className="text-[11px] font-mono text-gray-500">
                        {r.employee.empCode}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {r.employee.department?.name || "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="badge"
                        style={{
                          backgroundColor:
                            (r.shiftTemplate?.color || "#6b7280") + "15",
                          color: r.shiftTemplate?.color || "#6b7280",
                          borderColor:
                            (r.shiftTemplate?.color || "#6b7280") + "30",
                        }}
                      >
                        {r.shiftTemplate?.name || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-emerald-700">
                      {r.actualIn ? (
                        format(r.actualIn, "HH:mm:ss")
                      ) : (
                        <span className="text-red-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-blue-700">
                      {r.actualOut ? (
                        format(r.actualOut, "HH:mm:ss")
                      ) : (
                        <span className="text-red-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-medium">
                      {r.workedMinutes > 0
                        ? `${(r.workedMinutes / 60).toFixed(1)}h`
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      {r.overtimeMinutes > 0 ? (
                        <span className="font-bold text-purple-600">
                          {r.overtimeMinutes}m
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={r.status} size="sm" />
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground max-w-[240px]">
                      {r.remarks || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
