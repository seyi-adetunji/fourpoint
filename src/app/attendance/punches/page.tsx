import prisma from "@/lib/prisma";
import { format, addDays, subDays, startOfMonth, endOfMonth } from "date-fns";
import { getUTCMidnight } from "@/lib/dateUtils";
export const dynamic = "force-dynamic";
import { Search } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { classifyDevice } from "@/lib/attendanceProcessor";
import { splitEmployeeName } from "@/lib/timesheetExport";
import {
  PunchesClient,
  type PunchRow,
  type ScopedEmployeeInfo,
} from "@/components/attendance/PunchesClient";

export default async function AttendancePunchesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role ?? "EMPLOYEE";
  const userDeptId = (session?.user as any)?.departmentId as number | null;
  const preparedBy = session?.user?.name || "";
  const isDeptScoped = ["HOD", "DEPT_ADMIN", "SUPERVISOR"].includes(userRole);

  const monthStr = params?.month as string | undefined; // e.g. "2026-07"
  const dateStr = params?.date as string | undefined;
  const endDateStr = params?.endDate as string | undefined;
  const query = (params?.q as string | undefined)?.trim() || "";
  const deptParam = isDeptScoped
    ? userDeptId
      ? String(userDeptId)
      : undefined
    : (params?.department as string | undefined);

  let startDate: Date;
  let endDate: Date;

  const todayIso = format(new Date(), "yyyy-MM-dd");

  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr) && !dateStr) {
    const firstDay = getUTCMidnight(`${monthStr}-01`);
    const lastDayLocal = endOfMonth(new Date(`${monthStr}-01T00:00:00`));
    startDate = firstDay;
    endDate = getUTCMidnight(format(lastDayLocal, "yyyy-MM-dd"));
  } else if (dateStr) {
    startDate = getUTCMidnight(dateStr);
    endDate = endDateStr ? getUTCMidnight(endDateStr) : startDate;
  } else {
    // Always default to the current day so both KPI cards and punch lists show today's records
    startDate = getUTCMidnight(todayIso);
    endDate = getUTCMidnight(todayIso);
  }

  // If startDate & endDate are in the same calendar month, compute the full month bounds
  // so that the FT Associate Time Sheet export covers days 1..N of that month accurately.
  const startIso = startDate.toISOString().slice(0, 10);
  const endIso = endDate.toISOString().slice(0, 10);
  const isShowingToday = startIso === todayIso && endIso === todayIso;
  const sameMonth = startIso.slice(0, 7) === endIso.slice(0, 7);

  const timesheetStartIso = sameMonth
    ? format(startOfMonth(new Date(`${startIso}T00:00:00`)), "yyyy-MM-dd")
    : startIso;
  const timesheetEndIso = sameMonth
    ? format(endOfMonth(new Date(`${startIso}T00:00:00`)), "yyyy-MM-dd")
    : endIso;

  const queryStart = subDays(
    getUTCMidnight(timesheetStartIso < startIso ? timesheetStartIso : startIso),
    1
  );
  const queryEndInclusive = getUTCMidnight(
    timesheetEndIso > endIso ? timesheetEndIso : endIso
  );
  const queryEndExclusive = addDays(queryEndInclusive, 2);

  const [departments, rawPunches, shiftAssignments, deptEmployeesRaw] =
    await Promise.all([
      prisma.department.findMany({ orderBy: { name: "asc" } }),
      prisma.iclockTransaction.findMany({
        where: {
          punchTime: { gte: queryStart, lt: queryEndExclusive },
        },
        include: {
          employee: { include: { department: true } },
          terminal: true,
        },
        orderBy: { punchTime: "desc" },
        take: 50000,
      }),
      prisma.shiftAssignment.findMany({
        where: {
          workDate: { gte: queryStart, lte: queryEndInclusive },
          status: { not: "CANCELLED" },
        },
        include: {
          employee: { select: { empCode: true } },
        },
      }),
      deptParam
        ? prisma.employee.findMany({
            where: { departmentId: Number(deptParam) },
            include: { department: true },
            orderBy: { empCode: "asc" },
          })
        : Promise.resolve([]),
    ]);

  // Build map of scheduled non-cancelled shift counts per (empCode|YYYY-MM-DD)
  const shiftCountsByEmpDate: Record<string, number> = {};
  for (const sa of shiftAssignments) {
    const code = sa.employee?.empCode;
    if (!code) continue;
    const dStr = sa.workDate.toISOString().slice(0, 10);
    const key = `${code}|${dStr}`;
    shiftCountsByEmpDate[key] = (shiftCountsByEmpDate[key] || 0) + 1;
  }

  // Resolve any punches where empId was null by looking up empCode
  const missingCodes = Array.from(
    new Set(
      rawPunches.filter((p) => !p.employee && p.empCode).map((p) => p.empCode)
    )
  );
  const empByCode = new Map<
    string,
    {
      id: number;
      firstName: string;
      lastName: string | null;
      empCode: string;
      departmentId: number | null;
      departmentName: string;
    }
  >();

  if (missingCodes.length > 0) {
    const matchedEmps = await prisma.employee.findMany({
      where: { empCode: { in: missingCodes } },
      include: { department: true },
    });
    for (const e of matchedEmps) {
      empByCode.set(e.empCode, {
        id: e.id,
        firstName: e.fullName,
        lastName: e.lastName,
        empCode: e.empCode,
        departmentId: e.departmentId,
        departmentName: e.department?.name || "—",
      });
    }
  }

  const transformPunchList = (
    sourcePunches: typeof rawPunches,
    minIso: string,
    maxIso: string
  ): PunchRow[] => {
    const out: PunchRow[] = [];
    for (const p of sourcePunches) {
      const pDateIso = format(new Date(p.punchTime), "yyyy-MM-dd");
      if (pDateIso < minIso || pDateIso > maxIso) continue;

      const fallbackEmp = empByCode.get(p.empCode);
      const firstName = p.employee?.fullName ?? fallbackEmp?.firstName ?? "";
      const lastName = p.employee?.lastName ?? fallbackEmp?.lastName ?? null;
      const empCode = p.employee?.empCode || p.empCode || "—";
      const { surname, givenNames, displayFullName } = firstName
        ? splitEmployeeName(firstName, lastName)
        : {
            surname: `Staff #${empCode}`,
            givenNames: "",
            displayFullName: `Staff #${empCode}`,
          };

      const departmentId =
        p.employee?.departmentId ?? fallbackEmp?.departmentId ?? null;
      const department =
        p.employee?.department?.name || fallbackEmp?.departmentName || "—";

      if (deptParam && departmentId !== Number(deptParam)) {
        continue;
      }

      if (
        query &&
        !displayFullName.toLowerCase().includes(query.toLowerCase()) &&
        !firstName.toLowerCase().includes(query.toLowerCase()) &&
        !empCode.toLowerCase().includes(query.toLowerCase())
      ) {
        continue;
      }

      const dev = classifyDevice(p);
      out.push({
        id: p.id,
        empId: p.empId ?? fallbackEmp?.id ?? null,
        empCode,
        fullName: displayFullName,
        surname,
        givenNames,
        department,
        departmentId,
        punchTime: p.punchTime.toISOString(),
        deviceCategory: dev.category,
        deviceLabel: dev.label,
        terminalSn: dev.sn,
      });
    }
    return out;
  };

  const visiblePunches = transformPunchList(rawPunches, startIso, endIso);
  const timesheetPunches =
    timesheetStartIso === startIso && timesheetEndIso === endIso
      ? visiblePunches
      : transformPunchList(rawPunches, timesheetStartIso, timesheetEndIso);

  const scopedEmployees: ScopedEmployeeInfo[] = deptEmployeesRaw
    .map((e) => {
      const { surname, givenNames, displayFullName } = splitEmployeeName(
        e.fullName,
        e.lastName
      );
      return {
        empCode: e.empCode,
        fullName: displayFullName,
        surname,
        givenNames,
        department: e.department?.name || "—",
      };
    })
    .filter((e) => {
      if (!query) return true;
      return (
        e.fullName.toLowerCase().includes(query.toLowerCase()) ||
        e.empCode.toLowerCase().includes(query.toLowerCase())
      );
    });

  const selectedDeptObj = deptParam
    ? departments.find((d) => d.id === Number(deptParam))
    : undefined;
  const departmentLabel = selectedDeptObj?.name || "All Departments";

  return (
    <div className="page-container animate-fade-in space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Punches</h1>
          <p className="page-subtitle">
            Separated biometric records for{" "}
            <strong>Staff Gate (Attendance In/Out)</strong> and{" "}
            <strong>Canteen Device (Meal Tickets)</strong> —{" "}
            <span className="font-semibold text-primary">
              {isShowingToday
                ? `Today (${format(new Date(`${startIso}T00:00:00`), "EEE, dd MMM yyyy")})`
                : startIso === endIso
                ? format(new Date(`${startIso}T00:00:00`), "EEE, dd MMM yyyy")
                : `${format(new Date(`${startIso}T00:00:00`), "dd MMM yyyy")} – ${format(
                    new Date(`${endIso}T00:00:00`),
                    "dd MMM yyyy"
                  )}`}
            </span>
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-border rounded-2xl p-4 shadow-xs">
        <form className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              name="date"
              defaultValue={startIso}
              className="input max-w-[150px]"
            />
            <span className="text-gray-400 text-xs">to</span>
            <input
              type="date"
              name="endDate"
              defaultValue={endIso}
              className="input max-w-[150px]"
            />
          </div>

          {!isDeptScoped && (
            <select
              name="department"
              defaultValue={deptParam || ""}
              className="input max-w-[190px]"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              name="q"
              type="text"
              defaultValue={query}
              placeholder="Search employee or ID..."
              className="input pl-9 max-w-[210px]"
            />
          </div>

          <button type="submit" className="btn-primary btn-sm">
            Filter
          </button>
          <a href="/attendance/punches" className="btn-secondary btn-sm">
            Reset
          </a>
        </form>
      </div>

      <PunchesClient
        punches={visiblePunches}
        timesheetPunches={timesheetPunches}
        timesheetStartDate={timesheetStartIso}
        timesheetEndDate={timesheetEndIso}
        shiftCountsByEmpDate={shiftCountsByEmpDate}
        scopedEmployees={scopedEmployees}
        departmentLabel={departmentLabel}
        preparedBy={preparedBy}
      />
    </div>
  );
}
