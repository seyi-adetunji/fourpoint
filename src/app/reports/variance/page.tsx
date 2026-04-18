import prisma from "@/lib/prisma";
export const dynamic = "force-dynamic";
import { format, differenceInMinutes } from "date-fns";
import { getUTCMidnight, calculateMinutesBetweenTimes } from "@/lib/dateUtils";
import { ExportButtons } from "@/components/ExportButtons";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function VarianceReportPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams;
  const session = await getServerSession(authOptions);
  
  const isDeptScoped = ["HOD", "DEPT_ADMIN", "SUPERVISOR"].includes(session?.user?.role ?? "");
  const departmentId = (session?.user as any)?.departmentId as number | null;

  const startDateStr = params?.startDate as string | undefined;
  const endDateStr = params?.endDate as string | undefined;

  const startDate = startDateStr ? getUTCMidnight(startDateStr) : getUTCMidnight();
  const endDate = endDateStr ? getUTCMidnight(endDateStr) : new Date(startDate);
  if (!endDateStr) endDate.setDate(startDate.getDate() + 1); // Default to one day if not specified

  const results = await prisma.attendanceResult.findMany({
    where: {
      workDate: { gte: startDate, lte: endDate },
      ...(isDeptScoped && departmentId && { employee: { departmentId } }),
    },
    include: { 
      employee: { include: { department: true } },
      shiftTemplate: true,
      shiftAssignment: true
    },
    orderBy: [{ workDate: "asc" }, { employee: { fullName: "asc" } }],
  });

  const variances = results.map(r => {
    // Planned Duration
    const plannedMinutes = r.shiftTemplate 
      ? calculateMinutesBetweenTimes(r.shiftTemplate.startTime, r.shiftTemplate.endTime) - (r.shiftTemplate.breakMinutes || 60)
      : 0;
    
    // Actual Duration
    const actualMinutes = r.workedMinutes - (r.breakMinutes || 0);
    const variance = actualMinutes - plannedMinutes;
    
    return {
      id: r.id,
      date: format(r.workDate, "MMM dd, yyyy"),
      employee: r.employee.fullName,
      department: r.employee.department?.name || "—",
      shift: r.shiftTemplate?.name || "No Shift",
      plannedHrs: (plannedMinutes / 60).toFixed(1),
      actualHrs: (actualMinutes / 60).toFixed(1),
      varianceHrs: (variance / 60).toFixed(1),
      status: r.status,
      varianceType: variance > 30 ? "OVERTIME" : variance < -30 ? "SHORTFALL" : "OK"
    };
  });

  const exportHeaders = [
    { label: "Date", key: "date" },
    { label: "Employee", key: "employee" },
    { label: "Department", key: "department" },
    { label: "Shift", key: "shift" },
    { label: "Planned (H)", key: "plannedHrs" },
    { label: "Actual (H)", key: "actualHrs" },
    { label: "Variance (H)", key: "varianceHrs" },
    { label: "Attendance Status", key: "status" },
  ];

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header justify-between">
        <div>
          <h1 className="page-title">Variance Report</h1>
          <p className="page-subtitle">Planned Rota vs Actual Biometric Hours</p>
        </div>
        <ExportButtons data={variances} filename="variance_report" headers={exportHeaders} />
      </div>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <form className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <input type="date" name="startDate" defaultValue={format(startDate, "yyyy-MM-dd")} className="input" />
              <span className="text-muted-foreground">to</span>
              <input type="date" name="endDate" defaultValue={format(endDate, "yyyy-MM-dd")} className="input" />
            </div>
            <button type="submit" className="btn-primary btn-sm">Generate Report</button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-gray-50/30">
              <tr>
                <th className="px-5 py-3.5 text-left font-semibold">Date</th>
                <th className="px-5 py-3.5 text-left font-semibold">Employee</th>
                <th className="px-5 py-3.5 text-left font-semibold">Shift Type</th>
                <th className="px-5 py-3.5 text-right font-semibold">Planned</th>
                <th className="px-5 py-3.5 text-right font-semibold">Actual</th>
                <th className="px-5 py-3.5 text-right font-semibold">Variance</th>
                <th className="px-5 py-3.5 text-center font-semibold">Indicator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {variances.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">No data found for the selected period.</td></tr>
              ) : variances.map(v => (
                <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 text-gray-900 font-medium">{v.date}</td>
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-gray-900">{v.employee}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">{v.department}</div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">{v.shift}</td>
                  <td className="px-5 py-3.5 text-right font-mono">{v.plannedHrs}h</td>
                  <td className="px-5 py-3.5 text-right font-mono">{v.actualHrs}h</td>
                  <td className={`px-5 py-3.5 text-right font-mono font-bold ${Number(v.varianceHrs) > 0.5 ? 'text-blue-600' : Number(v.varianceHrs) < -0.5 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {Number(v.varianceHrs) > 0 ? '+' : ''}{v.varianceHrs}h
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      v.varianceType === 'OVERTIME' ? 'bg-blue-100 text-blue-700' : 
                      v.varianceType === 'SHORTFALL' ? 'bg-red-100 text-red-700' : 
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {v.varianceType}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
