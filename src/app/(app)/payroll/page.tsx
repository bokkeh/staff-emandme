import { auth } from "@/lib/auth";
import { ensureCurrentPayPeriod } from "@/lib/payroll";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { PayrollClient } from "./payroll-client";
import { addDays, differenceInCalendarDays } from "date-fns";

type PayrollPeriod = {
  id: string;
  startDate: Date;
  endDate: Date;
  status: string;
  type: string;
};

type ExpenseWithEmployee = Prisma.ExpenseGetPayload<{ include: { employee: true } }>;

export const dynamic = "force-dynamic";

function isMissingExpenseTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Expense") &&
    (message.includes("does not exist") || message.includes("relation") || message.includes("P2021"))
  );
}

export default async function PayrollPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = (session.user as { role?: string })?.role;

  if (role !== "ADMIN" && role !== "MANAGER") {
    redirect("/dashboard");
  }

  const ensuredCurrentPeriod = await ensureCurrentPayPeriod(prisma);
  const payPeriods = await prisma.payPeriod.findMany({
    orderBy: { startDate: "desc" },
    take: 10,
  });

  const openPeriod = payPeriods.find((p: PayrollPeriod) => p.id === ensuredCurrentPeriod?.id);
  if (
    openPeriod &&
    (openPeriod.type !== "BIWEEKLY" ||
      differenceInCalendarDays(openPeriod.endDate, openPeriod.startDate) !== 13)
  ) {
    await prisma.payPeriod.update({
      where: { id: openPeriod.id },
      data: {
        type: "BIWEEKLY",
        endDate: addDays(openPeriod.startDate, 13),
      },
    });
  }

  const rawPeriods = await prisma.payPeriod.findMany({
    orderBy: { startDate: "desc" },
    take: 20,
  });

  // Deduplicate by startDate (keeps the most-recently-created record per start date)
  const seenStarts = new Set<string>();
  const normalizedPeriods = rawPeriods.filter((p: PayrollPeriod) => {
    const key = new Date(p.startDate).toISOString().split("T")[0];
    if (seenStarts.has(key)) return false;
    seenStarts.add(key);
    return true;
  }).slice(0, 10);

  const currentPeriod =
    normalizedPeriods.find((p: PayrollPeriod) => p.id === ensuredCurrentPeriod?.id) ?? normalizedPeriods[0] ?? null;

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

  const periodEntries = normalizedPeriods.length
    ? await prisma.timeEntry.findMany({
        where: { payPeriodId: { in: normalizedPeriods.map((p: PayrollPeriod) => p.id) } },
        include: { employee: true, category: true },
      })
    : [];

  let periodExpenses: ExpenseWithEmployee[] = [];
  if (normalizedPeriods.length) {
    try {
      periodExpenses = await prisma.expense.findMany({
        where: {
          payPeriodId: { in: normalizedPeriods.map((p: PayrollPeriod) => p.id) },
          status: { not: "DRAFT" },
        },
        include: { employee: true },
      });
    } catch (error) {
      if (!isMissingExpenseTableError(error)) {
        throw error;
      }
      // Allow payroll page to load before expense migration is applied in production.
      periodExpenses = [];
    }
  }

  return (
    <div>
      <PageHeader
        title="Payroll"
        description="Review time entries, approve hours, and export pay period summaries."
      />
      <PayrollClient
        payPeriods={normalizedPeriods}
        currentPeriod={currentPeriod}
        employees={employees}
        pendingEntries={pendingEntries}
        periodEntries={periodEntries}
        periodExpenses={periodExpenses}
        currentRole={role ?? "MANAGER"}
      />
    </div>
  );
}
