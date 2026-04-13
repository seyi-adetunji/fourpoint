import prisma from "@/lib/prisma";
export const dynamic = "force-dynamic";
import { Fingerprint, Filter } from "lucide-react";
import { format } from "date-fns";
import { getUTCMidnight } from "@/lib/dateUtils";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default async function MissingPunchReport({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; deptId?: string }>;
}) {
  const params = await searchParams;
  const targetDate = getUTCMidnight(params.date as string | undefined);

  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
  
  const exceptions = await prisma.attendanceException.findMany({
    where: {
      workDate: targetDate,
      type: "MISSING_PUNCH",
      ...(params.deptId ? { employee: { departmentId: Number(params.deptId) } } : {}),
    },
    include: {
      employee: { include: { department: true } },
    },
    orderBy: { employee: { fullName: "asc" } },
  });

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Missing Punch Audit</h1>
          <p className="page-subtitle">Incomplete attendance logs requiring manual adjustment for {format(targetDate, "PPP")}</p>
        </div>
      </div>

      <div className="card p-4 mb-6">
        <form className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase">Date</label>
            <input type="date" name="date" defaultValue={params.date || format(targetDate, "yyyy-MM-dd")} className="input py-2" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase">Department</label>
            <select name="deptId" className="input py-2" defaultValue={params.deptId || ""}>
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-primary py-2 px-4 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </form>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {exceptions.length === 0 ? (
          <div className="col-span-full card p-12 text-center text-muted-foreground">
            No missing punches found for this date.
          </div>
        ) : (
          exceptions.map(e => (
            <div key={e.id} className="card p-5 border-t-4 border-orange-500">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg bg-orange-50 text-orange-600">
                  <Fingerprint className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{e.employee.empCode}</p>
                  <p className="text-[10px] text-muted-foreground">{e.employee.department?.name || "—"}</p>
                </div>
              </div>
              <h3 className="font-bold text-primary text-lg mb-1">{e.employee.fullName}</h3>
              <p className="text-xs text-muted-foreground italic mb-4">
                "{e.details || "Incomplete punch record"}"
              </p>
              <div className="mt-4 flex items-center justify-between">
                <StatusBadge status="MISSING_PUNCH" />
                <StatusBadge status={e.status} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
