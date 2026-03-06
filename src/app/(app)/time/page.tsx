import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { TimeTrackingClient } from "./time-tracking-client";
import { startOfWeek, endOfWeek } from "date-fns";

export const dynamic = "force-dynamic";

export default async function TimePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const employeeId = (session.user as { employeeId?: string })?.employeeId;
  if (!employeeId) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        No employee profile linked to your account. Contact an admin.
      </div>
    );
  }

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const [categories, activeTimer, weekEntries] = await Promise.all([
    prisma.timeCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.activeTimer.findUnique({
      where: { employeeId },
      include: { category: true },
    }),
    prisma.timeEntry.findMany({
      where: {
        employeeId,
        entryDate: { gte: weekStart, lte: weekEnd },
      },
      include: { category: true },
      orderBy: { startTime: "desc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Time Tracking"
        description="Track your hours and manage time entries."
      />
      <TimeTrackingClient
        categories={categories}
        activeTimer={activeTimer}
        weekEntries={weekEntries}
        employeeId={employeeId}
      />
    </div>
  );
}
