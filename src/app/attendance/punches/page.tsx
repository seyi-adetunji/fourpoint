import prisma from "@/lib/prisma";
import { format, startOfDay } from "date-fns";
export const dynamic = "force-dynamic";
import { Search, Download } from "lucide-react";

export default async function AttendancePunchesPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams;
  const dateStr = params?.date as string | undefined;
  const query = params?.q as string | undefined;

  const targetDate = dateStr ? startOfDay(new Date(dateStr)) : startOfDay(new Date());
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const punches = await prisma.attendancePunch.findMany({
    where: {
      punchTime: { gte: targetDate, lt: nextDay },
      ...(query && {
        employee: { fullName: { contains: query, mode: "insensitive" as any } },
      }),
    },
    include: { employee: { include: { department: true } } },
    orderBy: { punchTime: "desc" },
    take: 200,
  });

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Punches</h1>
          <p className="page-subtitle">Raw biometric punch data from ZKBioTime</p>
        </div>
      </div>
      <div className="table-wrapper">
        <div className="table-toolbar">
          <form className="flex items-center gap-3 flex-wrap">
            <input type="date" name="date" defaultValue={format(targetDate, "yyyy-MM-dd")} className="input max-w-[180px]" />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input name="q" type="text" defaultValue={query} placeholder="Search employee..." className="input input-with-icon max-w-[200px]" />
            </div>
            <button type="submit" className="btn-primary btn-sm">Filter</button>
          </form>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{punches.length} punches</span>
            <button className="btn-secondary btn-sm"><Download className="w-3.5 h-3.5" /> CSV</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-gray-50/30">
              <tr>
                <th className="px-5 py-3.5 text-left font-semibold">Employee</th>
                <th className="px-5 py-3.5 text-left font-semibold">Employee Code</th>
                <th className="px-5 py-3.5 text-left font-semibold">Department</th>
                <th className="px-5 py-3.5 text-left font-semibold">Punch Time</th>
                <th className="px-5 py-3.5 text-left font-semibold">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {punches.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">No punches found for this date.</td></tr>
              ) : punches.map(p => (
                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{p.employee.fullName}</td>
                  <td className="px-5 py-3.5"><span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{p.employee.empCode}</span></td>
                  <td className="px-5 py-3.5 text-gray-600">{p.employee.department?.name || "—"}</td>
                  <td className="px-5 py-3.5 font-mono text-xs font-semibold">{format(p.punchTime, "HH:mm:ss")}</td>
                  <td className="px-5 py-3.5"><span className="badge bg-gray-50 text-gray-700 border-gray-200">{p.source}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
