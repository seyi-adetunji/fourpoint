import prisma from "@/lib/prisma";
import { Fingerprint, Filter } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import StatusBadge from "@/components/ui/StatusBadge";

export default async function MissingPunchReport({
  searchParams,
}: {
  searchParams: { date?: string; deptId?: string };
}) {
  const date = searchParams.date ? new Date(searchParams.date) : new Date();
  const start = startOfDay(date);
  const end = endOfDay(date);

  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
  
  const exceptions = await prisma.attendanceException.findMany({
    where: {
      workDate: { gte: start, lte: end },
      type: "MISSING_PUNCH",
      ...(searchParams.deptId ? { employee: { departmentId: searchParams.deptId } } : {}),
    },
    include: {
      employee: { include: { department: true } },
    },
  });

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Missing Punch Report</h1>
          <p className="page-subtitle">Punches flagged for interpretation on {format(date, "PPP")}</p>
        </div>
      </div>

      <div className="card p-4 mb-6">
        <form className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase">Date</label>
            <input type="date" name="date" defaultValue={searchParams.date || format(new Date(), "yyyy-MM-dd")} className="input py-2" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase">Department</label>
            <select name="deptId" className="input py-2" defaultValue={searchParams.deptId || ""}>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {exceptions.length === 0 ? (
          <div className="col-span-full card p-12 text-center text-muted-foreground">
            No missing punches found for this selection.
          </div>
        ) : (
          exceptions.map(e => (
            <div key={e.id} className="card p-5 border-l-4 border-pink-500">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-pink-50">
                  <Fingerprint className="w-5 h-5 text-pink-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-primary">{e.employee.fullName}</h3>
                  <p className="text-xs text-muted-foreground">{e.employee.empCode} • {e.employee.department.name}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-600 leading-relaxed italic">
                "{e.description}"
              </p>
              <div className="mt-4 flex items-center justify-between">
                <StatusBadge status="warning" label="MISSING PUNCH" />
                <StatusBadge status={e.status === "RESOLVED" ? "success" : "pending"} label={e.status} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
