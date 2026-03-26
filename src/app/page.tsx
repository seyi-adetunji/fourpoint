import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminDashboard } from "@/components/dashboards/AdminDashboard";
import { HODDashboard } from "@/components/dashboards/HODDashboard";
import { EmployeeDashboard } from "@/components/dashboards/EmployeeDashboard";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    redirect("/login");
  }

  const role = session.user.role;

  if (role === "SUPER_ADMIN" || role === "HR_ADMIN") {
    return <AdminDashboard session={session} />;
  } else if (role === "HOD") {
    return <HODDashboard session={session} />;
  } else {
    // SUPERVISOR and EMPLOYEE
    return <EmployeeDashboard session={session} />;
  }
}
