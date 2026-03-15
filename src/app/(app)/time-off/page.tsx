import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { TimeOffClient } from "./time-off-client";

export const dynamic = "force-dynamic";

export default async function TimeOffPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const employeeId = (session.user as { employeeId?: string })?.employeeId;
  const role = (session.user as { role?: string })?.role;

  if (!employeeId) redirect("/dashboard");

  const isManager = role === "ADMIN" || role === "MANAGER";

  const requests = isManager
    ? await prisma.timeOffRequest.findMany({
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, preferredName: true, profilePhotoUrl: true } },
          reviewedBy: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
        },
        orderBy: { startDate: "desc" },
      })
    : await prisma.timeOffRequest.findMany({
        where: { employeeId },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, preferredName: true, profilePhotoUrl: true } },
          reviewedBy: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
        },
        orderBy: { startDate: "desc" },
      });

  return (
    <div>
      <PageHeader
        title="Time Off"
        description={isManager ? "Manage time off requests for the team." : "Request and track your time off."}
      />
      <TimeOffClient
        initialRequests={requests}
        currentEmployeeId={employeeId}
        isManager={isManager}
      />
    </div>
  );
}
