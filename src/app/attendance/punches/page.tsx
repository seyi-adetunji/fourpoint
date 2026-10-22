import prisma from "@/lib/prisma";
import { format, subDays, addDays } from "date-fns";
import { getUTCMidnight } from "@/lib/dateUtils";
export const dynamic = "force-dynamic";
import { Search } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { classifyDevice } from "@/lib/attendanceProcessor";
import { PunchesClient, type PunchRow } from "@/components/attendance/PunchesClient";

export default async function AttendancePunchesPage({
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
  const query = (params?.q as string | undefined)?.trim() || "";
  const deptParam = isDeptScoped
    ? userDeptId
      ? String(userDeptId)
      : undefined
    : (params?.department as string | undefined);

  // Determine date range: if no date param is supplied, default to a 30-day window up to the latest punch
  let startDate: Date;
  let endDate: Date;

  if (dateStr) {
    startDate = getUTCMidnight(dateStr);
    endDate = endDateStr ? getUTCMidnight(endDateStr) : startDate;
  } else {
    const latestPunch = await prisma.iclockTransaction.findFirst({
      orderBy: { punchTime: "desc" },
      select: { punchTime: true },
    });
    const anchor = latestPunch
      ? getUTCMidnight(latestPunch.punchTime.toISOString().slice(0, 10))
      : getUTCMidnight();
    endDate = anchor;
    startDate = getUTCMidnight(subDays(anchor, 30).toISOString().slice(0, 10));
  }

  const rangeEndExclusive = addDays(endDate, 1);

  const [departments, rawPunches] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.iclockTransaction.findMany({
      where: {
        punchTime: { gte: startDate, lt: rangeEndExclusive },
      },
      include: {
        employee: { include: { department: true } },
        terminal: true,
      },
      orderBy: { punchTime: "desc" },
      take: 2000,
    }),
  ]);

  // Resolve any punches where empId was null by looking up empCode
  const missingCodes = Array.from(
    new Set(rawPunches.filter((p) => !p.employee && p.empCode).map((p) => p.empCode))
  );
  const empByCode = new Map<
    string,
    { id: number; fullName: string; empCode: string; departmentId: number | null; departmentName: string }
  >();

  if (missingCodes.length > 0) {
    const matchedEmps = await prisma.employee.findMany({
      where: { empCode: { in: missingCodes } },
      include: { department: true },
    });
    for (const e of matchedEmps) {
      empByCode.set(e.empCode, {
        id: e.id,
        fullName: e.fullName,
        empCode: e.empCode,
        departmentId: e.departmentId,
        departmentName: e.department?.name || "—",
      });
    }
  }

  // Transform and classify into STAFF_GATE vs CANTEEN
  const allRows: PunchRow[] = [];
  for (const p of rawPunches) {
    const fallbackEmp = empByCode.get(p.empCode);
    const fullName = p.employee?.fullName || fallbackEmp?.fullName || `Staff #${p.empCode}`;
    const empCode = p.employee?.empCode || p.empCode || "—";
    const departmentId = p.employee?.departmentId ?? fallbackEmp?.departmentId ?? null;
    const department =
      p.employee?.department?.name || fallbackEmp?.departmentName || "—";

    // Filter by department if specified
    if (deptParam && departmentId !== Number(deptParam)) {
      continue;
    }

    // Filter by search query if specified
    if (
      query &&
      !fullName.toLowerCase().includes(query.toLowerCase()) &&
      !empCode.toLowerCase().includes(query.toLowerCase())
    ) {
      continue;
    }

    const dev = classifyDevice(p);
    allRows.push({
      id: p.id,
      empId: p.empId ?? fallbackEmp?.id ?? null,
      empCode,
      fullName,
      department,
      departmentId,
      punchTime: p.punchTime.toISOString(),
      deviceCategory: dev.category,
      deviceLabel: dev.label,
      terminalSn: dev.sn,
    });
  }

  return (
    <div className="page-container animate-fade-in space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Punches</h1>
          <p className="page-subtitle">
            Separated biometric records for <strong>Staff Gate (Attendance In/Out)</strong> and{" "}
            <strong>Canteen Device (Meal Tickets)</strong> ({format(startDate, "dd MMM yyyy")}
            {startDate.getTime() !== endDate.getTime()
              ? ` – ${format(endDate, "dd MMM yyyy")}`
              : ""}
            )
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
              defaultValue={format(startDate, "yyyy-MM-dd")}
              className="input max-w-[150px]"
            />
            <span className="text-gray-400 text-xs">to</span>
            <input
              type="date"
              name="endDate"
              defaultValue={format(endDate, "yyyy-MM-dd")}
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

      <PunchesClient punches={allRows} />
    </div>
  );
}
