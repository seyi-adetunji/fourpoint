import prisma from "@/lib/prisma";
export const dynamic = "force-dynamic";
import { Settings, Shield, Clock } from "lucide-react";
import ManageShiftTemplates from "@/components/ManageShiftTemplates";
import ManageDepartments from "@/components/ManageDepartments";

export default async function SettingsPage() {
  const [templates, departments] = await Promise.all([
    prisma.shiftTemplate.findMany({
      orderBy: { code: "asc" },
    }),
    prisma.department.findMany({
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto flex flex-col items-stretch">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            Settings
          </h1>
          <p className="text-gray-500 mt-2">
            Configure system parameters and preferences.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-2">
          <nav className="flex flex-col gap-1">
            <button className="text-left px-4 py-3 rounded-lg bg-primary/10 text-primary font-medium text-sm transition-colors">
              Shift Templates
            </button>
            <button className="text-left px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 font-medium text-sm transition-colors">
              Company Settings
            </button>
            <button className="text-left px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50 font-medium text-sm transition-colors">
              Notifications
            </button>
          </nav>
        </div>
        
        <div className="lg:col-span-2">
          {/* Shift Templates Management Area */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border bg-gray-50/50">
              <h2 className="text-xl font-semibold text-primary">Shift Templates</h2>
              <p className="text-sm text-gray-500 mt-1">Manage standard shift types and grace periods.</p>
            </div>
            <div className="p-6">
              <ManageShiftTemplates initialTemplates={templates} />
              <div className="mt-8 border-t border-border pt-2" />
              <ManageDepartments initialDepartments={departments} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
