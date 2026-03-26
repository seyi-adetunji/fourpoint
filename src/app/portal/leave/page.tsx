import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { format } from "date-fns";
import { LeaveRequestForm } from "@/components/portal/LeaveRequestForm";

export default async function LeavePage() {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user || !session.user.employeeId) {
    redirect("/login");
  }

  const employeeId = session.user.employeeId;

  const pastRequests = await prisma.leaveRequest.findMany({
    where: { employeeId: employeeId },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Leave Management</h1>
        <p className="text-muted-foreground mt-2 text-gray-500">
          Request time off and view your leave history.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Request Leave" description="Submit a new request to HR / HOD.">
          <LeaveRequestForm />
        </Card>

        <Card title="Past Requests" description="Your recently submitted leave requests.">
          <div className="divide-y divide-border -mx-6 -my-6 mt-0">
            {pastRequests.length === 0 ? (
              <div className="p-6 text-sm text-gray-500 text-center">No leave requests found.</div>
            ) : (
              pastRequests.map(req => {
                let statusType: "SUCCESS" | "WARNING" | "ERROR" | "PENDING" = "PENDING";
                if (req.status === "APPROVED") statusType = "SUCCESS";
                if (req.status === "REJECTED") statusType = "ERROR";

                return (
                  <div key={req.id} className="p-4 px-6 flex items-start justify-between hover:bg-gray-50 transition-colors">
                    <div>
                      <div className="font-medium text-primary">
                        {format(req.startDate, "MMM d")} - {format(req.endDate, "MMM d, yyyy")}
                      </div>
                      <div className="text-sm text-gray-500 mt-0.5 space-x-2">
                        <span className="font-medium">{req.type}</span>
                        {req.reason && <span>• {req.reason}</span>}
                      </div>
                    </div>
                    <div>
                      <StatusBadge status={statusType} label={req.status} />
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
