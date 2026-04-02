"use client";

import { useState, useTransition } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface PendingShiftActionsProps {
  assignmentId: string;
}

export function PendingShiftActions({ assignmentId }: PendingShiftActionsProps) {
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
