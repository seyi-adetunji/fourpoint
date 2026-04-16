"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { 
  LayoutDashboard, Users, Calendar, Clock, AlertTriangle, 
  Building2, Layers, CalendarOff, BarChart3, Settings,
  LogOut, ChevronDown, ChevronRight, Fingerprint, ClipboardCheck,
  FileEdit, UserCircle, ShieldAlert
} from "lucide-react";
import { useState } from "react";

// Icon map to resolve string icon names
const iconMap: Record<string, any> = {
  LayoutDashboard, Users, Calendar, Clock, AlertTriangle,
  Building2, Layers, CalendarOff, BarChart3, Settings,
  Fingerprint, ClipboardCheck, FileEdit, UserCircle, ShieldAlert,
};

interface NavItemConfig {
  name: string;
  href: string;
  icon: string;
  children?: NavItemConfig[];
}

// Admin/Manager navigation
const adminNav: NavItemConfig[] = [
  { name: "Dashboard", href: "/", icon: "LayoutDashboard" },
  { name: "Employees", href: "/employees", icon: "Users" },
  { name: "Departments", href: "/departments", icon: "Building2" },
  { name: "Shift Templates", href: "/shift-templates", icon: "Layers" },
  { name: "Shift Assignments", href: "/shifts", icon: "Calendar" },
  { 
    name: "Attendance", href: "/attendance", icon: "Clock",
    children: [
      { name: "Punches", href: "/attendance/punches", icon: "Fingerprint" },
      { name: "Results", href: "/attendance/results", icon: "ClipboardCheck" },
      { name: "Exceptions", href: "/attendance/exceptions", icon: "AlertTriangle" },
      { name: "Intel Report", href: "/reports/daily-attendance", icon: "ShieldAlert" },
    ],
  },
  { name: "Leave", href: "/leave", icon: "CalendarOff" },
  { 
    name: "Reports", href: "/reports", icon: "BarChart3",
    children: [
      { name: "Summary", href: "/reports/summary", icon: "ClipboardCheck" },
      { name: "Overtime", href: "/reports/overtime", icon: "Clock" },
      { name: "Variance (Actual vs Plan)", href: "/reports/variance", icon: "ShieldAlert" },
      { name: "Schedule", href: "/reports/schedule", icon: "Calendar" },
    ]
  },
];

// Employee-only navigation
const employeeNav: NavItemConfig[] = [
  { name: "My Dashboard", href: "/employee/dashboard", icon: "LayoutDashboard" },
  { name: "My Shifts", href: "/employee/shifts", icon: "Calendar" },
  { name: "My Attendance", href: "/employee/attendance", icon: "Clock" },
  { name: "Leave Requests", href: "/employee/leave", icon: "CalendarOff" },
  { name: "Corrections", href: "/employee/corrections", icon: "FileEdit" },
];

function getNavForRole(role: string): NavItemConfig[] {
  switch (role) {
    case "SUPER_ADMIN":
    case "HR_ADMIN":
      return adminNav;
    case "HOD":
      return adminNav.filter(item => 
        !["Departments", "Shift Templates"].includes(item.name)
      );
    case "SUPERVISOR":
      return adminNav.filter(item => 
        ["Dashboard", "Employees", "Shift Assignments", "Attendance", "Reports"].includes(item.name)
      );
    case "EMPLOYEE":
      return employeeNav;
    default:
      return employeeNav;
  }
}

function NavItem({ item, depth = 0 }: { item: NavItemConfig; depth?: number }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(
    item.children?.some(c => pathname.startsWith(c.href)) || false
  );
  const Icon = iconMap[item.icon] || LayoutDashboard;
  const hasChildren = item.children && item.children.length > 0;
  
  const isActive = hasChildren 
    ? item.children!.some(c => pathname === c.href || pathname.startsWith(c.href + "/"))
    : pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
            ${isActive 
              ? "bg-sidebar-active text-sidebar-active-text" 
              : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-white"
            }`}
        >
          <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? "text-sidebar-active-text" : "text-gray-500 group-hover:text-gray-300"}`} />
          <span className="flex-1 text-left">{item.name}</span>
          {expanded 
            ? <ChevronDown className="w-4 h-4 text-gray-500" /> 
            : <ChevronRight className="w-4 h-4 text-gray-500" />
          }
        </button>
        {expanded && (
          <div className="ml-4 mt-1 space-y-0.5 animate-fade-in">
            {item.children!.map(child => (
              <NavItem key={child.href} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
        ${isActive 
          ? "bg-sidebar-active text-sidebar-active-text" 
          : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-white"
        }
        ${depth > 0 ? "text-[13px] py-2 pl-4" : ""}`}
    >
      <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? "text-sidebar-active-text" : "text-gray-500 group-hover:text-gray-300"}`} />
      <span>{item.name}</span>
      {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />}
    </Link>
  );
}

import { useMobileNav } from "./MobileNavContext";

// ... (rest of the iconMap and NavItem remains same)

export function SidebarClient() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { isOpen, close } = useMobileNav();

  if (!session?.user) return null;
  if (pathname === "/login") return null;

  const role = (session.user as any).role || "EMPLOYEE";
  const navItems = getNavForRole(role);
  const showSettings = ["SUPER_ADMIN", "HR_ADMIN"].includes(role);

  const sidebarContent = (
    <div className="flex flex-col w-64 h-full bg-sidebar border-r border-sidebar-border">
      {/* ─── Logo / Branding ─── */}
      <div className="flex items-center h-[72px] px-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center">
            <span className="text-accent font-bold text-lg">W</span>
          </div>
          <div className="flex flex-col">
            <span className="text-white font-bold text-[15px] tracking-tight leading-tight">WorkforceOps</span>
            <span className="text-[10px] text-gray-500 font-medium tracking-widest uppercase">Hotel Manager</span>
          </div>
        </div>
      </div>
      
      {/* ─── User info ─── */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center text-white font-bold text-sm ring-2 ring-accent/30">
            {session.user.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-semibold text-white truncate">{session.user.name}</span>
            <span className="text-[11px] text-accent font-medium">{role.replace(/_/g, " ")}</span>
          </div>
        </div>
      </div>

      {/* ─── Navigation ─── */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-3 mb-3">
          {role === "EMPLOYEE" ? "Self Service" : "Operations"}
        </p>
        {navItems.map(item => (
          <NavItem key={item.href} item={item} />
        ))}
      </div>

      {/* ─── Footer ─── */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        {showSettings && (
          <Link
            href="/settings"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
              ${pathname === "/settings" 
                ? "bg-sidebar-active text-sidebar-active-text" 
                : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-white"
              }`}
          >
            <Settings className="w-[18px] h-[18px] text-gray-500" />
            Settings
          </Link>
        )}
        <Link
          href="/profile"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground hover:bg-sidebar-hover hover:text-white transition-all duration-200"
        >
          <UserCircle className="w-[18px] h-[18px] text-gray-500" />
          Profile
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200"
        >
          <LogOut className="w-[18px] h-[18px]" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar (Drawer) */}
      <div 
        className={`fixed inset-0 z-50 lg:hidden transition-all duration-300 ease-in-out ${
          isOpen ? "visible opacity-100" : "invisible opacity-0"
        }`}
      >
        {/* Backdrop */}
        <div 
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
            isOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={close}
        />
        
        {/* Drawer Content */}
        <aside 
          className={`absolute inset-y-0 left-0 w-64 bg-sidebar transition-transform duration-300 ease-in-out transform ${
            isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {sidebarContent}
        </aside>
      </div>
    </>
  );
}
