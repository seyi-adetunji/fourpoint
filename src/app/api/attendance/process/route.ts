import { NextRequest, NextResponse } from "next/server";
import { getUTCMidnight } from "@/lib/dateUtils";
import { syncAttendanceResultsForRange } from "@/lib/attendanceProcessor";

export const dynamic = "force-dynamic";

/**
 * POST /api/attendance/process?date=YYYY-MM-DD[&endDate=YYYY-MM-DD]
 * Also accepts JSON body { date, endDate }.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const dateParam = req.nextUrl.searchParams.get("date") || body.date;
    const endDateParam = req.nextUrl.searchParams.get("endDate") || body.endDate || dateParam;

    const startDate = dateParam ? getUTCMidnight(dateParam) : getUTCMidnight();
    const endDate = endDateParam ? getUTCMidnight(endDateParam) : startDate;

    const { processed } = await syncAttendanceResultsForRange(startDate, endDate);

    return NextResponse.json({
      success: true,
      date: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
      processed,
    });
  } catch (error: any) {
    console.error("Attendance processing error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
