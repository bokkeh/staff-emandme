import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { PayrollClient } from "./payroll-client";

export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = (session.user as { role?: string })?.role;
  const employeeId = (session.user as { employeeId?: string })?.employeeId;

  if (role !== "ADMIN" && role !== "MANAGER") {
    redirect("/dashboard");
  }

  const payPeriods = await prisma.payPeriod.findMany({
    orderBy: { startDate: "desc" },
    take: 10,
  });

  const currentPeriod = payPeriods.find((p) => p.status === "OPEN") ?? payPeriods[0] ?? null;

  const employees = await prisma.employee.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ lastName: "asc" }],
  });

  const pendingEntries = await prisma.timeEntry.findMany({
    where: {
      status: "SUBMITTED",
      ...(currentPeriod ? { payPeriodId: currentPeriod.id } : {}),
    },
    include: {
      employee: true,
      category: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const periodEntries = currentPeriod
    ? await prisma.timeEntry.findMany({
        where: { payPeriodId: currentPeriod.id },
        include: { employee: true, category: true },
      })
    : [];

  return (
    <div>
      <PageHeader
        title="Payroll"
        description="Review time entries, approve hours, and export pay period summaries."
      />
      <PayrollClient
        payPeriods={payPeriods}
        currentPeriod={currentPeriod}
        employees={employees}
        pendingEntries={pendingEntries}
        periodEntries={periodEntries}
        currentRole={role ?? "MANAGER"}
      />
    </div>
  );
}
