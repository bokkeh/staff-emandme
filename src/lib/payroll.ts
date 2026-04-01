import { addDays } from "date-fns";
import type { PrismaClient, Prisma, PayPeriod } from "@prisma/client";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

function normalizeDate(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

type PayPeriodStatus = PayPeriod["status"];

async function createPeriod(
  prisma: PrismaLike,
  startDate: Date,
  status: PayPeriodStatus
) {
  return prisma.payPeriod.create({
    data: {
      startDate,
      endDate: addDays(startDate, 13),
      type: "BIWEEKLY",
      status,
    },
  });
}

export async function ensurePayPeriodForDate(
  prisma: PrismaLike,
  targetDate: Date
) {
  const normalizedTarget = normalizeDate(targetDate);

  const existing = await prisma.payPeriod.findFirst({
    where: {
      startDate: { lte: normalizedTarget },
      endDate: { gte: normalizedTarget },
    },
    orderBy: { startDate: "desc" },
  });

  if (existing) {
    await prisma.payPeriod.updateMany({
      where: {
        status: "OPEN",
        endDate: { lt: normalizedTarget },
      },
      data: { status: "CLOSED" },
    });

    if (existing.status !== "OPEN") {
      return existing;
    }

    await prisma.payPeriod.updateMany({
      where: {
        status: "OPEN",
        id: { not: existing.id },
        startDate: { lte: normalizedTarget },
      },
      data: { status: "CLOSED" },
    });

    return existing;
  }

  await prisma.payPeriod.updateMany({
    where: {
      status: "OPEN",
      endDate: { lt: normalizedTarget },
    },
    data: { status: "CLOSED" },
  });

  const latest = await prisma.payPeriod.findFirst({
    orderBy: { endDate: "desc" },
  });

  if (!latest) {
    return createPeriod(prisma, normalizedTarget, "OPEN");
  }

  let nextStartDate = normalizeDate(addDays(latest.endDate, 1));
  let current = latest;

  while (nextStartDate <= normalizedTarget) {
    current = await createPeriod(
      prisma,
      nextStartDate,
      addDays(nextStartDate, 13) >= normalizedTarget ? "OPEN" : "CLOSED"
    );
    nextStartDate = normalizeDate(addDays(current.endDate, 1));
  }

  return current.startDate <= normalizedTarget && current.endDate >= normalizedTarget
    ? current
    : null;
}

export async function ensureCurrentPayPeriod(prisma: PrismaLike) {
  return ensurePayPeriodForDate(prisma, new Date());
}
