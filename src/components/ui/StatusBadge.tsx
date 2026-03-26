/**
 * StatusBadge component for attendance statuses.
 * 
 * Color mapping per spec:
 * Present → Green, Late → Orange, Absent → Red, Off → Gray,
 * Exception → Gold, Leave → Blue, Pending → Orange, Approved → Green
 */

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  PRESENT: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "Present" },
  LATE: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", label: "Late" },
  EARLY_EXIT: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", label: "Early Exit" },
  LATE_AND_EARLY: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", label: "Late & Early" },
  ABSENT: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", label: "Absent" },
  NO_SHOW: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", label: "No Show" },
  MISSING_PUNCH: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", label: "Missing Punch" },
  OFF: { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200", label: "Off" },
  LEAVE: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", label: "Leave" },
  EXCEPTION: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", label: "Exception" },
  PENDING: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", label: "Pending" },
  REVIEWING: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", label: "Reviewing" },
  APPROVED: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "Approved" },
  REJECTED: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", label: "Rejected" },
  RESOLVED: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "Resolved" },
  DISMISSED: { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200", label: "Dismissed" },
  SCHEDULED: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", label: "Scheduled" },
  CONFIRMED: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "Confirmed" },
  CANCELLED: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", label: "Cancelled" },
};

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] || { 
    bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200", label: status.replace(/_/g, " ") 
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-semibold
      ${style.bg} ${style.text} ${style.border}
      ${size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"}`}
    >
      <span className={`rounded-full ${style.text === "text-emerald-700" ? "bg-emerald-500" : style.text === "text-red-700" ? "bg-red-500" : style.text === "text-amber-700" ? "bg-amber-500" : style.text === "text-blue-700" ? "bg-blue-500" : style.text === "text-orange-700" ? "bg-orange-500" : "bg-gray-400"} ${size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2"}`} />
      {style.label}
    </span>
  );
}
export default StatusBadge;
