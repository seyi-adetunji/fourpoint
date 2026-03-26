import prisma from "@/lib/prisma";
import { format, startOfDay } from "date-fns";
import { Download, Search } from "lucide-react";

export default async function AttendancePage() {
  const today = startOfDay(new Date());

  const results = await prisma.attendanceResult.findMany({
    where: {
      date: {
        lte: today, // past and today
      }
    },
    include: {
      employee: true,
      shiftAssignment: {
        include: {
          shiftTemplate: true
        }
      }
    },
    orderBy: [
      { date: "desc" },
      { employee: { name: "asc" } }
    ],
    take: 100 // Limit for display
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PRESENT":
        return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800">Present</span>;
      case "LATE":
        return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-amber-100 text-amber-800">Late</span>;
      case "EARLY_EXIT":
        return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-amber-100 text-amber-800">Early Exit</span>;
      case "ABSENT":
        return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-red-100 text-red-800">Absent</span>;
      case "NO_SHOW":
        return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-red-100 text-red-800">No Show</span>;
      case "MISSING_PUNCH":
        return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-orange-100 text-orange-800">Missing Punch</span>;
      default:
        return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto flex flex-col items-stretch">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Attendance Results</h1>
          <p className="text-gray-500 mt-2">View daily attendance logs and daily processed statuses.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-border rounded-md hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between bg-gray-50/50">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by name or date..." 
              className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 border-b border-border">
              <tr>
                <th scope="col" className="px-6 py-4 font-medium">Date</th>
                <th scope="col" className="px-6 py-4 font-medium">Employee</th>
                <th scope="col" className="px-6 py-4 font-medium">Shift Details</th>
                <th scope="col" className="px-6 py-4 font-medium">In / Out</th>
                <th scope="col" className="px-6 py-4 font-medium">Status</th>
                <th scope="col" className="px-6 py-4 font-medium text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {results.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No attendance records found.
                  </td>
                </tr>
              ) : (
                results.map((res) => (
                  <tr key={res.id} className="bg-card hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                      {format(res.date, "MMM dd, yyyy")}
                    </td>
                    <td className="px-6 py-4 text-primary font-medium">
                      {res.employee.name}
                      <span className="block text-xs text-gray-500 font-normal">{res.employee.code}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-700 whitespace-nowrap">
                      <div className="font-semibold text-xs">{res.shiftAssignment.shiftTemplate.name}</div>
                      <div className="text-xs text-gray-500">
                        {res.shiftAssignment.shiftTemplate.startTime} - {res.shiftAssignment.shiftTemplate.endTime}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 whitespace-nowrap min-w-[120px]">
                      <div className="text-xs">
                        <span className="text-gray-400 w-8 inline-block">IN:</span> 
                        <span className="font-medium text-gray-900">
                          {res.punchIn ? format(res.punchIn, "HH:mm") : <span className="text-red-500 font-semibold">Missing</span>}
                        </span>
                      </div>
                      <div className="text-xs mt-1">
                        <span className="text-gray-400 w-8 inline-block">OUT:</span> 
                        <span className="font-medium text-gray-900">
                          {res.punchOut ? format(res.punchOut, "HH:mm") : <span className="text-red-500 font-semibold">Missing</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        {getStatusBadge(res.status)}
                        {res.minutesLate > 0 && (
                          <span className="text-[10px] text-amber-600 font-medium">{res.minutesLate} mins late</span>
                        )}
                        {res.minutesEarly > 0 && (
                          <span className="text-[10px] text-amber-600 font-medium">{res.minutesEarly} mins early exit</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="font-medium text-accent hover:underline text-xs">
                        View
                      </button>
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
