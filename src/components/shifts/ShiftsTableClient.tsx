"use client";

import { useState, useTransition } from "react";
import { CheckSquare, Square, Check, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import GroupEditShiftModal from "@/components/GroupEditShiftModal";

interface AssignmentWithRelations {
  id: string;
  employeeId: number;
  workDate: string;
  status: string;
  sequence: number;
  employee: {
    fullName: string;
    empCode: string;
    department: { name: string } | null;
  };
  shiftTemplate: {
    name: string;
    startTime: string;
    endTime: string;
    color: string;
  };
}

interface ShiftsTableClientProps {
  initialGroups: AssignmentWithRelations[][];
  isAdmin: boolean;
  isHOD: boolean;
  statusFilter?: string;
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

export function ShiftsTableClient({ initialGroups, isAdmin, isHOD, statusFilter }: ShiftsTableClientProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [groups, setGroups] = useState(initialGroups);

  const showPendingActions = statusFilter === "PENDING_APPROVAL" && isAdmin;
  
  const pendingAssignments = groups
    .filter(g => g.some(a => a.status === "PENDING_APPROVAL"))
    .flatMap(g => g.filter(a => a.status === "PENDING_APPROVAL").map(a => a.id));

  const allSelected = pendingAssignments.length > 0 && pendingAssignments.every(id => selectedIds.has(id));
  const someSelected = pendingAssignments.some(id => selectedIds.has(id)) && !allSelected;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingAssignments));
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

  const handleBulkAction = async (action: "approve" | "reject") => {
    if (selectedIds.size === 0) return;
    
    startTransition(async () => {
      try {
        const res = await fetch(`/api/shifts/bulk-approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, assignmentIds: Array.from(selectedIds) }),
        });

        if (!res.ok) throw new Error("Failed to process request");

        toast.success(`${selectedIds.size} shift(s) ${action === "approve" ? "approved" : "rejected"} successfully`);
        setSelectedIds(new Set());
        router.refresh();
      } catch (err) {
        console.error(err);
        toast.error("An error occurred");
      }
    });
  };

  return (
    <>
      {showPendingActions && selectedIds.size > 0 && (
        <div className="mb-4 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-amber-800">
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
              Approve Selected
            </button>
            <button
              onClick={() => handleBulkAction("reject")}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              Reject Selected
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-gray-50/30">
            <tr>
              {showPendingActions && (
                <th className="px-5 py-3.5 font-semibold w-10">
                  <button
                    onClick={handleSelectAll}
                    className="p-1 hover:bg-gray-100 rounded"
                    disabled={pendingAssignments.length === 0}
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
              {(isAdmin || isHOD) && (
                <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {groups.length === 0 ? (
              <tr>
                <td colSpan={showPendingActions ? 7 : 6} className="px-5 py-12 text-center text-muted-foreground">
                  No shift assignments found. Click <strong>Assign Shift</strong> to get started.
                </td>
              </tr>
            ) : (
              groups.map((group) => {
                const first = group[0];
                const label = shiftCountLabel(group.length);
                const groupPendingIds = group.filter(a => a.status === "PENDING_APPROVAL").map(a => a.id);
                const allInGroupSelected = groupPendingIds.length > 0 && groupPendingIds.every(id => selectedIds.has(id));
                const someInGroupSelected = groupPendingIds.some(id => selectedIds.has(id)) && !allInGroupSelected;
                
                return (
                  <tr
                    key={`${first.employeeId}|${first.workDate}`}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    {showPendingActions && (
                      <td className="px-5 py-3.5">
                        {groupPendingIds.length > 0 && (
                          <button
                            onClick={() => groupPendingIds.forEach(id => handleSelect(id))}
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
                        )}
                      </td>
                    )}
                    <td className="px-5 py-3.5 font-medium text-gray-900 whitespace-nowrap">
                      {format(new Date(first.workDate), "MMM dd, yyyy")}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-gray-900">{first.employee.fullName}</div>
                      <span className="text-xs text-muted-foreground font-mono">{first.employee.empCode}</span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {first.employee.department?.name || "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1">
                        {group.length > 1 && (
                          <span className="inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200 mb-0.5">
                            <span>⚡</span> {label}
                          </span>
                        )}
                        {group.map((a) => (
                          <div key={a.id} className="flex items-center gap-1.5">
                            {group.length > 1 && (
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
                            <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">
                              {a.shiftTemplate.startTime}–{a.shiftTemplate.endTime}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-0.5">
                        {group.map((a) => (
                          <span
                            key={a.id}
                            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border w-fit ${STATUS_STYLES[a.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}
                          >
                            {a.status.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    </td>
                    {(isAdmin || isHOD) && (
                      <td className="px-5 py-3.5 text-right">
                        {showPendingActions ? (
                          <div className="flex items-center justify-end gap-1">
                            {group.map((a) => (
                              <SingleShiftActions key={a.id} assignmentId={a.id} />
                            ))}
                          </div>
                        ) : (
                          <GroupEditShiftModal assignments={group as any} readOnly={isHOD} />
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
    </>
  );
}