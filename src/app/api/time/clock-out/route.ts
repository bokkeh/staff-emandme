import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { differenceInMinutes } from "date-fns";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = (session.user as { employeeId?: string })?.employeeId;
  if (!employeeId) return NextResponse.json({ error: "No employee record" }, { status: 403 });

  const timer = await prisma.activeTimer.findUnique({ where: { employeeId } });
  if (!timer) return NextResponse.json({ error: "Not clocked in" }, { status: 404 });

  const now = new Date();
  const duration = Math.max(1, differenceInMinutes(now, timer.startedAt));

  // Find current pay period
  const payPeriod = await prisma.payPeriod.findFirst({
    where: {
      startDate: { lte: now },
      endDate: { gte: now },
      status: "OPEN",
    },
  });

  const entry = await prisma.$transaction(async (tx) => {
    const newEntry = await tx.timeEntry.create({
      data: {
        employeeId,
        categoryId: timer.categoryId,
        payPeriodId: payPeriod?.id,
        entryDate: timer.startedAt,
        startTime: timer.startedAt,
        endTime: now,
        durationMinutes: duration,
        note: timer.note,
        source: "TIMER",
        status: "DRAFT",
      },
      include: { category: true },
    });

    await tx.activeTimer.delete({ where: { employeeId } });

    return newEntry;
  });

  return NextResponse.json(entry);
}
