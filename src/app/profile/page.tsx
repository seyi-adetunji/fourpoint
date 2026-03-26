import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { User, Shield, Building2, Mail, Calendar } from "lucide-react";
import { format } from "date-fns";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { department: true, employee: true },
  });

  if (!user) redirect("/login");

  return (
    <div className="page-container animate-fade-in max-w-3xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile</h1>
          <p className="page-subtitle">Your account information</p>
        </div>
      </div>

      <Card>
        <div className="flex items-center gap-6 mb-8">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-3xl">
            {user.name[0].toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-primary">{user.name}</h2>
            <p className="text-sm text-muted-foreground">{user.role.replace(/_/g, " ")}</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-border">
            <Mail className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground font-medium">Email</p>
              <p className="text-sm font-medium text-gray-900">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-border">
            <Shield className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground font-medium">Role</p>
              <p className="text-sm font-medium text-gray-900">{user.role.replace(/_/g, " ")}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-border">
            <Building2 className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground font-medium">Department</p>
              <p className="text-sm font-medium text-gray-900">{user.department?.name || "Not assigned"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-border">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground font-medium">Account Created</p>
              <p className="text-sm font-medium text-gray-900">{format(user.createdAt, "MMMM d, yyyy")}</p>
            </div>
          </div>

          {user.employee && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-border">
              <User className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground font-medium">Employee Code</p>
                <p className="text-sm font-medium text-gray-900 font-mono">{user.employee.empCode}</p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
