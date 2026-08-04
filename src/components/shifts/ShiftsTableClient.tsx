"use client";

import { useState, useTransition } from "react";
import { CheckSquare, Square, Check, X, Loader2, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import GroupEditShiftModal from "@/components/GroupEditShiftModal";

export type GroupedShift = {
  id: string;
  employeeId: number;
  workDate: string;
  employee: { fullName: string; empCode: string; department: { name: string } | null };
  assignments: {
    id: string;
    status: string;
    sequence: number;
    shiftTemplateId: string;
    shiftTemplate: { id: string; name: string; startTime: string; endTime: string; color: string };
  }[];
};

interface ShiftsTableClientProps {
  groups: GroupedShift[];
  isAdmin: boolean;
  isHOD: boolean;
  statusFilter?: string;
  pagination: {
    page: number;
    totalPages: number;
  };
}

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-blue-50 text-blue-700 border-blue-200",
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
  PENDING_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
  SWAPPED: "bg-purple-50 text-purple-700 border-purple-200",
};

function shiftCountLabel(count: number) {
  if (count === 1) return null;
  if (count === 2) return "Double Shift";
  if (count === 3) return "Triple Shift";
  return `×${count} Shift`;
}

function SingleShiftActions({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleAction = async (action: "approve" | "reject") => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/shifts/${assignmentId}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });

        if (!res.ok) throw new Error("Failed to process request");

        toast.success(`Shift ${action === "approve" ? "approved" : "rejected"} successfully`);
        router.refresh();
      } catch (err) {
        console.error(err);
        toast.error("An error occurred");
      }
    });
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleAction("approve")}
        disabled={isPending}
        className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
        title="Approve"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
      </button>
      <button
        onClick={() => handleAction("reject")}
        disabled={isPending}
        className="p-1.5 rounded-md text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
        title="Reject"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ShiftsTableClient({ groups, isAdmin, isHOD, statusFilter, pagination }: ShiftsTableClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const canManage = isAdmin || isHOD;
  const allAssignmentIds = groups.flatMap(g => g.assignments.map(a => a.id));

  const allSelected = allAssignmentIds.length > 0 && allAssignmentIds.every(id => selectedIds.has(id));
  const someSelected = allAssignmentIds.some(id => selectedIds.has(id)) && !allSelected;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allAssignmentIds));
    }
  };

  const handleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkAction = async (action: "approve" | "reject" | "delete") => {
    if (selectedIds.size === 0) return;
    
    if (action === "delete" && !confirm(`Are you sure you want to delete ${selectedIds.size} shift(s)?`)) {
      return;
    }
    
    startTransition(async () => {
      try {
        const url = action === "delete" ? `/api/shifts/bulk-delete` : `/api/shifts/bulk-approve`;
        const body = action === "delete" 
          ? { assignmentIds: Array.from(selectedIds) }
          : { action, assignmentIds: Array.from(selectedIds) };
          
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || "Failed to process request");
        }

        toast.success(`${selectedIds.size} shift(s) ${action === "delete" ? "deleted" : action + "d"} successfully`);
        setSelectedIds(new Set());
        router.refresh();
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || "An error occurred");
      }
    });
  };

  const goToPage = (pageNumber: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", pageNumber.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleDeleteGroup = (groupIds: string[]) => {
    if (!confirm("Are you sure you want to clear this shift assignment?")) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/shifts/bulk-delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignmentIds: groupIds }),
        });
        if (!res.ok) throw new Error("Failed to clear shift");
        toast.success(`Shift cleared successfully`);
        router.refresh();
      } catch (err: any) {
        toast.error(err.message || "An error occurred");
      }
    });
  };

  return (
    <>
      {canManage && selectedIds.size > 0 && (
        <div className="mb-4 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-blue-800">
              {selectedIds.size} shift(s) selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkAction("approve")}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Approve
            </button>
            <button
              onClick={() => handleBulkAction("reject")}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              Reject
            </button>
            <button
              onClick={() => handleBulkAction("delete")}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-gray-50/30">
            <tr>
              {canManage && (
                <th className="px-5 py-3.5 font-semibold w-10">
                  <button
                    onClick={handleSelectAll}
                    className="p-1 hover:bg-gray-100 rounded"
                    disabled={allAssignmentIds.length === 0}
                  >
                    {allSelected ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : someSelected ? (
                      <div className="relative">
                        <Square className="w-4 h-4 text-primary" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-2 h-2 bg-primary rounded-sm" />
                        </div>
                      </div>
                    ) : (
                      <Square className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </th>
              )}
              <th className="px-5 py-3.5 font-semibold">Date</th>
              <th className="px-5 py-3.5 font-semibold">Employee</th>
              <th className="px-5 py-3.5 font-semibold">Department</th>
              <th className="px-5 py-3.5 font-semibold">Shifts</th>
              <th className="px-5 py-3.5 font-semibold">Status</th>
              {canManage && (
                <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {groups.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 7 : 6} className="px-5 py-12 text-center text-muted-foreground">
                  No shift assignments found.
                </td>
              </tr>
            ) : (
              groups.map((group) => {
                const label = shiftCountLabel(group.assignments.length);
                const groupIds = group.assignments.map(a => a.id);
                const allInGroupSelected = groupIds.length > 0 && groupIds.every(id => selectedIds.has(id));
                const someInGroupSelected = groupIds.some(id => selectedIds.has(id)) && !allInGroupSelected;
                
                return (
                  <tr
                    key={group.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    {canManage && (
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => groupIds.forEach(id => handleSelect(id))}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          {allInGroupSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : someInGroupSelected ? (
                            <div className="relative">
                              <Square className="w-4 h-4 text-primary" />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-2 h-2 bg-primary rounded-sm" />
                              </div>
                            </div>
                          ) : (
                            <Square className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </td>
                    )}
                    <td className="px-5 py-3.5 font-medium text-gray-900 whitespace-nowrap">
                      {format(new Date(group.workDate), "MMM dd, yyyy")}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-gray-900">{group.employee.fullName}</div>
                      <span className="text-xs text-muted-foreground font-mono">{group.employee.empCode}</span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {group.employee.department?.name || "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1">
                        {group.assignments.length > 1 && (
                          <span className="inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200 mb-0.5">
                            <span>⚡</span> {label}
                          </span>
                        )}
                        {group.assignments.map((a) => (
                          <div key={a.id} className="flex items-center gap-1.5">
                            {group.assignments.length > 1 && (
                              <span className="shrink-0 w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-bold bg-gray-200 text-gray-500">
                                {a.sequence}
                              </span>
                            )}
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border"
                              style={{
                                backgroundColor: (a.shiftTemplate.color || "#6b7280") + "18",
                                color: a.shiftTemplate.color || "#6b7280",
                                borderColor: (a.shiftTemplate.color || "#6b7280") + "35",
                              }}
                            >
                              {a.shiftTemplate.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap font-bold bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                              {a.shiftTemplate.startTime < "12:00" ? "AM" : "PM"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-0.5">
                        {group.assignments.map((a) => (
                          <span
                            key={a.id}
                            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border w-fit ${STATUS_STYLES[a.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}
                          >
                            {a.status.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    </td>
                    {canManage && (
                      <td className="px-5 py-3.5 text-right">
                        {statusFilter === "PENDING_APPROVAL" ? (
                          <div className="flex items-center justify-end gap-1">
                            {group.assignments.map((a) => (
                              <SingleShiftActions key={a.id} assignmentId={a.id} />
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <GroupEditShiftModal 
                              assignments={group.assignments.map(a => ({
                                ...a,
                                workDate: group.workDate,
                                employeeId: group.employeeId,
                                employee: group.employee
                              })) as any} 
                              readOnly={false} 
                            />
                            <button
                              onClick={() => handleDeleteGroup(groupIds)}
                              disabled={isPending}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                              title="Clear Shift"
                            >
                              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="px-5 py-3 border-t border-border flex items-center justify-between bg-gray-50/50">
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => goToPage(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <button
              onClick={() => goToPage(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}