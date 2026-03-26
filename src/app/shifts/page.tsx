import prisma from "@/lib/prisma";
export const dynamic = "force-dynamic";
import { format, startOfDay } from "date-fns";

export default async function ShiftsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const resolvedSearchParams = await searchParams;
  const selectedDate = resolvedSearchParams?.date ? startOfDay(new Date(resolvedSearchParams.date as string)) : startOfDay(new Date());
  const selectedEmployeeId = resolvedSearchParams?.employee as string | undefined;
  const deptId = resolvedSearchParams?.department as string | undefined;

  const [shiftAssignments, employees, departments] = await Promise.all([
    prisma.shiftAssignment.findMany({
      where: {
        ...(resolvedSearchParams?.date ? { workDate: selectedDate } : { workDate: { gte: selectedDate } }),
        ...(selectedEmployeeId && { employeeId: selectedEmployeeId }),
        ...(deptId && { employee: { departmentId: deptId } }),
      },
      include: {
        employee: { include: { department: true } },
        shiftTemplate: true,
      },
      orderBy: [
        { workDate: "asc" },
        { sequence: "asc" },
        { employee: { fullName: "asc" } },
      ],
      take: 200,
    }),
    prisma.employee.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, empCode: true, fullName: true },
    }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Shift Assignments</h1>
          <p className="page-subtitle">Manage rota scheduling and staff assignments</p>
        </div>
      </div>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <form className="flex items-center gap-3 flex-wrap">
            <input type="date" name="date" defaultValue={format(selectedDate, "yyyy-MM-dd")} className="input max-w-[180px]" />
            <select name="employee" defaultValue={selectedEmployeeId || ""} className="input max-w-[200px]">
              <option value="">All Employees</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.fullName} ({e.empCode})</option>)}
            </select>
            <select name="department" defaultValue={deptId || ""} className="input max-w-[180px]">
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button type="submit" className="btn-primary btn-sm">Filter</button>
          </form>
          <span className="text-xs text-muted-foreground">{shiftAssignments.length} assignments</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-gray-50/30">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Date</th>
                <th className="px-5 py-3.5 font-semibold">Employee</th>
                <th className="px-5 py-3.5 font-semibold">Department</th>
                <th className="px-5 py-3.5 font-semibold">Shift</th>
                <th className="px-5 py-3.5 font-semibold">Timing</th>
                <th className="px-5 py-3.5 font-semibold">Seq</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shiftAssignments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">
                    No shift assignments found.
                  </td>
                </tr>
              ) : (
                shiftAssignments.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-900">{format(a.workDate, "MMM dd, yyyy")}</td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-gray-900">{a.employee.fullName}</div>
                      <span className="text-xs text-muted-foreground font-mono">{a.employee.empCode}</span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{a.employee.department?.name || "—"}</td>
                    <td className="px-5 py-3.5">
                      <span className="badge" style={{ backgroundColor: (a.shiftTemplate.color || "#6b7280") + "15", color: a.shiftTemplate.color || "#6b7280", borderColor: (a.shiftTemplate.color || "#6b7280") + "30" }}>
                        {a.shiftTemplate.name}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs">{a.shiftTemplate.startTime} – {a.shiftTemplate.endTime}</td>
                    <td className="px-5 py-3.5 text-center text-xs">{a.sequence}</td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">{a.status}</td>
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
