import { ReactNode } from "react";
import { CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react";

type StatusType = "SUCCESS" | "WARNING" | "ERROR" | "INFO" | "PENDING";

interface StatusBadgeProps {
  status: StatusType;
  label: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  let styles = "";
  let Icon = null;

  switch (status) {
    case "SUCCESS":
      styles = "bg-green-50 text-green-700 border-green-200";
      Icon = CheckCircle2;
      break;
    case "WARNING":
      styles = "bg-yellow-50 text-yellow-700 border-yellow-200";
      Icon = AlertCircle;
      break;
    case "ERROR":
      styles = "bg-red-50 text-red-700 border-red-200";
      Icon = XCircle;
      break;
    case "PENDING":
    case "INFO":
    default:
      styles = "bg-blue-50 text-blue-700 border-blue-200";
      Icon = Clock;
      break;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles}`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}
