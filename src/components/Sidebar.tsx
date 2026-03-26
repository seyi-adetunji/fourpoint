import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LogoutButton } from "./LogoutButton";
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Clock, 
  AlertCircle,
  Settings,
  UserCircle
} from "lucide-react";

export async function Sidebar() {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    return null; // Do not render sidebar for unauthenticated users (e.g., login page)
  }

  const role = session.user.role;

  // Define full list of possible routes
  const allRoutes = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "HR_ADMIN", "HOD", "SUPERVISOR"] },
    { name: "My Portal", href: "/portal", icon: UserCircle, roles: ["EMPLOYEE", "SUPERVISOR", "HOD", "HR_ADMIN"] },
    { name: "Employees", href: "/employees", icon: Users, roles: ["SUPER_ADMIN", "HR_ADMIN", "HOD"] },
    { name: "Shift Assignments", href: "/shifts", icon: Calendar, roles: ["SUPER_ADMIN", "HR_ADMIN", "HOD"] },
    { name: "Attendance", href: "/attendance", icon: Clock, roles: ["SUPER_ADMIN", "HR_ADMIN", "HOD", "SUPERVISOR"] },
    { name: "Exceptions", href: "/exceptions", icon: AlertCircle, roles: ["SUPER_ADMIN", "HR_ADMIN", "HOD"] },
  ];

  // Filter based on user role
  const allowedRoutes = allRoutes.filter(route => route.roles.includes(role as string));

  return (
    <div className="flex flex-col w-64 h-screen bg-sidebar border-r border-sidebar-border text-sidebar-foreground">
      <div className="flex items-center justify-center h-20 border-b border-sidebar-border relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-accent" />
        <h1 className="text-xl font-bold tracking-tight text-primary flex flex-col items-center">
          <span className="uppercase text-sm tracking-widest text-[#8a8d91] font-medium">Four Points</span>
          <span className="text-lg">Attendance</span>
        </h1>
      </div>
      
      <div className="flex-1 overflow-y-auto py-6">
        <div className="px-4 mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Logged in as</p>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              {session.user.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium truncate">{session.user.name}</span>
              <span className="text-xs text-secondary truncate">{role.replace("_", " ")}</span>
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-2 px-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-4 text-left">Main Menu</p>
          {allowedRoutes.map((item) => {
            const Icon = item.icon;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors hover:bg-primary/5 hover:text-primary group"
              >
                <Icon className="w-5 h-5 text-[#8a8d91] group-hover:text-primary transition-colors" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex flex-col gap-2">
          {["SUPER_ADMIN", "HR_ADMIN"].includes(role as string) && (
            <Link href="/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-[#8a8d91] hover:bg-primary/5 hover:text-primary transition-colors w-full">
              <Settings className="w-5 h-5" />
              Settings
            </Link>
          )}
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
