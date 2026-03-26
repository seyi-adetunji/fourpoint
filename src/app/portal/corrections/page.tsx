import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { format, subDays } from "date-fns";
import { CorrectionRequestForm } from "@/components/portal/CorrectionRequestForm";

export default async function CorrectionsPage() {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user || !session.user.employeeId) {
    redirect("/login");
  }

  const employeeId = session.user.employeeId;
  const thirtyDaysAgo = subDays(new Date(), 30);

  const [pastRequests, recentResults] = await Promise.all([
    prisma.attendanceCorrection.findMany({
      where: { employeeId: employeeId },
      include: { attendanceResult: true },
      orderBy: { createdAt: "desc" }
    }),
    prisma.attendanceResult.findMany({
      where: { 
        employeeId: employeeId,
        workDate: { gte: thirtyDaysAgo }
      },
      orderBy: { workDate: "desc" }
    })
  ]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Attendance Corrections</h1>
        <p className="text-muted-foreground mt-2 text-gray-500">
          Request a time correction for missed punches or system errors.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Submit Correction" description="Select a recent record to correct.">
          <CorrectionRequestForm recentResults={recentResults} />
        </Card>

        <Card title="Correction History" description="Your recently submitted requests.">
          <div className="divide-y divide-border -mx-6 -my-6 mt-0">
            {pastRequests.length === 0 ? (
              <div className="p-6 text-sm text-gray-500 text-center">No correction requests found.</div>
            ) : (
              pastRequests.map(req => {
                let statusType: "SUCCESS" | "WARNING" | "ERROR" | "PENDING" = "PENDING";
                if (req.status === "APPROVED") statusType = "SUCCESS";
                if (req.status === "REJECTED") statusType = "ERROR";

                return (
                  <div key={req.id} className="p-4 px-6 flex items-start justify-between hover:bg-gray-50 transition-colors">
                    <div>
                      <div className="font-medium text-primary">
                        {req.attendanceResult ? format(req.attendanceResult.workDate, "MMM d, yyyy") : "N/A"}
                      </div>
                      <div className="text-sm text-gray-500 mt-0.5 space-x-2">
                        <span>Original: {req.attendanceResult?.status.replace("_", " ") || "N/A"}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1 italic">
                        "{req.reason}"
                      </div>
                    </div>
                    <div>
                      <StatusBadge status={req.status} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
