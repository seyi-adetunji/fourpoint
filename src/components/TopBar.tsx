"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { format } from "date-fns";
import { Bell, Search, Menu } from "lucide-react";
import { useMobileNav } from "./MobileNavContext";

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Dashboard", subtitle: "Enterprise overview of workforce operations" },
  "/employees": { title: "Employees", subtitle: "Manage hotel staff and departments" },
  "/departments": { title: "Departments", subtitle: "Organizational department management" },
  "/shift-templates": { title: "Shift Templates", subtitle: "Configure shift definitions and schedules" },
  "/shifts": { title: "Shift Assignments", subtitle: "Manage rota scheduling and staff assignments" },
  "/attendance": { title: "Attendance", subtitle: "View attendance records and processing" },
  "/attendance/punches": { title: "Attendance Punches", subtitle: "Raw biometric punch data" },
  "/attendance/results": { title: "Attendance Results", subtitle: "Processed attendance records" },
  "/attendance/exceptions": { title: "Attendance Exceptions", subtitle: "Review and resolve attendance anomalies" },
  "/leave": { title: "Leave Management", subtitle: "Leave requests and approvals" },
  "/reports": { title: "Reports", subtitle: "Enterprise reporting and analytics" },
  "/settings": { title: "Settings", subtitle: "System configuration and preferences" },
  "/profile": { title: "Profile", subtitle: "Your account settings" },
  "/employee/dashboard": { title: "My Dashboard", subtitle: "Your personal workforce overview" },
  "/employee/shifts": { title: "My Shifts", subtitle: "Your upcoming shift schedule" },
  "/employee/attendance": { title: "My Attendance", subtitle: "Your attendance history" },
  "/employee/leave": { title: "Leave Requests", subtitle: "Submit and track leave requests" },
  "/employee/corrections": { title: "Corrections", subtitle: "Request attendance corrections" },
};

export function TopBar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { toggle } = useMobileNav();

  if (!session?.user || pathname === "/login") return null;

  // Find matching page title by trying exact match first, then prefix
  let pageInfo = PAGE_TITLES[pathname];
  if (!pageInfo) {
    const matchingKey = Object.keys(PAGE_TITLES)
      .filter(k => k !== "/")
      .sort((a, b) => b.length - a.length)
      .find(k => pathname.startsWith(k));
    pageInfo = matchingKey ? PAGE_TITLES[matchingKey] : { title: "Page", subtitle: "" };
  }

  return (
    <div className="h-16 border-b border-border bg-white flex items-center justify-between px-4 sm:px-6 lg:px-8 flex-shrink-0">
      <div className="flex items-center gap-4">
        <button 
          onClick={toggle}
          className="lg:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors"
          aria-label="Toggle Menu"
        >
          <Menu className="w-5 h-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-base sm:text-lg font-bold text-primary tracking-tight">{pageInfo.title}</h1>
          <p className="text-[10px] sm:text-xs text-muted-foreground -mt-0.5 hidden sm:block">{pageInfo.subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground font-medium hidden md:block">
          {format(new Date(), "EEEE, MMM d, yyyy")}
        </span>
        
        <div className="w-px h-6 bg-border hidden md:block" />

        <button className="p-2 rounded-xl hover:bg-gray-100 transition-colors relative group" title="Notifications">
          <Bell className="w-[18px] h-[18px] text-gray-500 group-hover:text-primary transition-colors" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
        </button>
      </div>
    </div>
  );
}
