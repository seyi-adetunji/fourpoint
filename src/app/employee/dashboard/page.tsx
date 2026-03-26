import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { EmployeeDashboard } from "@/components/dashboards/EmployeeDashboard";

export default async function EmployeeDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  
  return <EmployeeDashboard session={session} />;
}
