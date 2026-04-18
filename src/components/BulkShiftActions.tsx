"use client";

import { useState, useTransition } from "react";
import { Check, X, Loader2, MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface BulkShiftActionsProps {
  assignmentIds: string[];
}

export function BulkShiftActions({ assignmentIds }: BulkShiftActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const handleAction = async (action: "approve" | "reject") => {
    setOpen(false);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/shifts/bulk-approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, assignmentIds }),
        });

        if (!res.ok) throw new Error("Failed to process request");

        toast.success(`${assignmentIds.length} shift(s) ${action === "approve" ? "approved" : "rejected"} successfully`);
        router.refresh();
      } catch (err) {
        console.error(err);
        toast.error("An error occurred");
      }
    });
  };

  if (assignmentIds.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={isPending}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
        Bulk Action ({assignmentIds.length})
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-border z-50 py-1">
            <button
              onClick={() => handleAction("approve")}
              disabled={isPending}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              Approve All
            </button>
            <button
              onClick={() => handleAction("reject")}
              disabled={isPending}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              Reject All
            </button>
          </div>
        </>
      )}
    </div>
  );
}