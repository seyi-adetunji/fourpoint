"use client";

import { useState } from "react";
import { Edit2, Building2, Users } from "lucide-react";
import { EditDepartmentModal } from "@/components/modals/EditDepartmentModal";

interface DepartmentsClientProps {
  initialDepartments: any[];
  employees: any[];
  isAdmin: boolean;
}

export function DepartmentsClient({ initialDepartments, employees, isAdmin }: DepartmentsClientProps) {
  const [selectedDept, setSelectedDept] = useState<any>(null);

  return (
    <>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {initialDepartments.map(dept => (
          <div key={dept.id} className="card p-6 relative group">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl bg-primary/5">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600 border border-gray-200 uppercase tracking-tighter">
                  {dept.deptCode}
                </span>
                {isAdmin && (
                  <button 
                    onClick={() => setSelectedDept(dept)}
                    className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-gray-400 hover:text-accent transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            
            <h3 className="font-semibold text-primary text-lg mb-1">{dept.name}</h3>
            
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Head of Department</p>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-[10px] font-bold text-accent border border-accent/20">
                  {dept.departmentManager?.fullName?.[0] || "?"}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-700 leading-none">
                    {dept.departmentManager?.fullName || "Not Assigned"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Manager</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-gray-50 mt-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-50/50 px-2.5 py-1 rounded-lg">
                <Users className="w-3 h-3 text-gray-400" />
                <span>{dept._count.employees} Staff</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-50/50 px-2.5 py-1 rounded-lg">
                <Users className="w-3 h-3 text-gray-400" />
                <span>{dept._count.users} Users</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedDept && (
        <EditDepartmentModal 
          isOpen={true} 
          onClose={() => setSelectedDept(null)} 
          department={selectedDept}
          employees={employees}
        />
      )}
    </>
  );
}
