import UserManagement from "@/components/admin/UserManagement";
import { Shield, Info } from "lucide-react";

export const dynamic = "force-dynamic";

export default function UsersPage() {
  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            User Accounts
          </h1>
          <p className="page-subtitle">
            Manage system access, roles, and administrative permissions.
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex gap-3 text-blue-700">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold">Security Note</p>
          <p className="opacity-90">
            User accounts are required for staff to log in. You can link a user to an existing employee profile to synchronize their attendance data and departmental access. 
            Roles determine what sections of the system a user can access (e.g., HR can manage all employees, while HODs only see their own department).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <UserManagement />
      </div>
    </div>
  );
}
