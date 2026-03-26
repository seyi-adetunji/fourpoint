import Link from "next/link";
export const dynamic = "force-dynamic";
import {
  ClipboardList, Users, Clock, Timer, AlertTriangle,
  CalendarOff, Layers, Fingerprint, UserX, BarChart3, Building2, FileText
} from "lucide-react";

const reports = [
  { 
    title: "Daily Attendance", 
    description: "Department attendance report for any given day",
    href: "/reports/daily", 
    icon: ClipboardList, 
    color: "text-blue-600", 
    bgColor: "bg-blue-50" 
  },
  { 
    title: "Shift Coverage", 
    description: "Staff coverage analysis per shift",
    href: "/reports/coverage", 
    icon: Users, 
    color: "text-indigo-600", 
    bgColor: "bg-indigo-50" 
  },
  { 
    title: "Late Coming", 
    description: "Late arrival tracking with frequency",
    href: "/reports/late", 
    icon: Clock, 
    color: "text-amber-600", 
    bgColor: "bg-amber-50" 
  },
  { 
    title: "Early Exit", 
    description: "Staff leaving before shift end",
    href: "/reports/early-exit", 
    icon: Clock, 
    color: "text-orange-600", 
    bgColor: "bg-orange-50" 
  },
  { 
    title: "Overtime", 
    description: "Overtime hours and approval status",
    href: "/reports/overtime", 
    icon: Timer, 
    color: "text-purple-600", 
    bgColor: "bg-purple-50" 
  },
  { 
    title: "Exceptions", 
    description: "Attendance anomalies and resolution",
    href: "/reports/exceptions", 
    icon: AlertTriangle, 
    color: "text-yellow-600", 
    bgColor: "bg-yellow-50" 
  },
  { 
    title: "Absence & Replacement", 
    description: "Absent staff and replacement coverage",
    href: "/reports/absence", 
    icon: UserX, 
    color: "text-red-600", 
    bgColor: "bg-red-50" 
  },
  { 
    title: "Double Shift", 
    description: "Extended and double shift tracking",
    href: "/reports/double-shift", 
    icon: Layers, 
    color: "text-violet-600", 
    bgColor: "bg-violet-50" 
  },
  { 
    title: "Missing Punch", 
    description: "Unresolved missing punch records",
    href: "/reports/missing-punch", 
    icon: Fingerprint, 
    color: "text-pink-600", 
    bgColor: "bg-pink-50" 
  },
  { 
    title: "Staff Summary", 
    description: "Individual attendance summary statistics",
    href: "/reports/summary", 
    icon: BarChart3, 
    color: "text-teal-600", 
    bgColor: "bg-teal-50" 
  },
  { 
    title: "Department Summary", 
    description: "Aggregated department-level metrics",
    href: "/reports/department-summary", 
    icon: Building2, 
    color: "text-cyan-600", 
    bgColor: "bg-cyan-50" 
  },
  { 
    title: "Leave & Holidays", 
    description: "Leave requests and holiday tracking",
    href: "/reports/leave", 
    icon: CalendarOff, 
    color: "text-sky-600", 
    bgColor: "bg-sky-50" 
  },
];

export default function ReportsPage() {
  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Enterprise reporting and compliance analytics</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <Link key={report.href} href={report.href} className="group">
              <div className="card p-5 group-hover:shadow-lg group-hover:border-primary/20 transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${report.bgColor} flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${report.color}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-primary text-sm group-hover:text-primary-dark transition-colors">
                      {report.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {report.description}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
