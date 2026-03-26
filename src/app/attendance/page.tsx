import { redirect } from "next/navigation";

// Redirect /attendance to /attendance/results
export default function AttendancePage() {
  redirect("/attendance/results");
}
