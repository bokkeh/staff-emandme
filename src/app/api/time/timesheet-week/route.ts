import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { addMinutes, parseISO, setHours, startOfDay } from "date-fns";

const schema = z.object({
  categoryId: z.string().min(1),
  note: z.string().optional(),
  days: z.array(
    z.object({
      entryDate: z.string(),
      minutes: z.number().int().min(0).max(24 * 60).refine((v) => v % 15 === 0, {
        message: "Minutes must be in 15-minute increments.",
      }),
    })
  ),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = (session.user as { employeeId?: string })?.employeeId;
  if (!employeeId) return NextResponse.json({ error: "No employee record" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error }, { status: 400 });
  }

  const requestedDays = parsed.data.days.filter((d) => d.minutes > 0);
  if (requestedDays.length === 0) {
    return NextResponse.json({ error: "Enter at least one day with time greater than 0." }, { status: 400 });
  }

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const day of requestedDays) {
        const entryDate = parseISO(day.entryDate);
        const minutes = day.minutes;

        const dayStart = startOfDay(entryDate);
        const defaultStart = setHours(dayStart, 9);

        const latestEntry = await tx.timeEntry.findFirst({
          where: {
            employeeId,
            entryDate: dayStart,
            status: { notIn: ["REJECTED"] },
          },
          orderBy: { endTime: "desc" },
        });

        if (latestEntry?.endTime === null) {
          throw new Error(`Cannot submit ${day.entryDate}: existing open entry has no end time.`);
        }

        const startTime =
          latestEntry?.endTime && latestEntry.endTime > defaultStart
            ? latestEntry.endTime
            : defaultStart;
        const endTime = addMinutes(startTime, minutes);

        const overlap = await tx.timeEntry.findFirst({
          where: {
            employeeId,
            status: { notIn: ["REJECTED"] },
            OR: [
              { startTime: { lte: startTime }, endTime: { gt: startTime } },
              { startTime: { lt: endTime }, endTime: { gte: endTime } },
              { startTime: { gte: startTime }, endTime: { lte: endTime } },
            ],
          },
        });

        if (overlap) {
          throw new Error(`Cannot submit ${day.entryDate}: hours overlap with another entry.`);
        }

        const payPeriod = await tx.payPeriod.findFirst({
          where: {
            startDate: { lte: dayStart },
            endDate: { gte: dayStart },
            status: "OPEN",
          },
        });

        const entry = await tx.timeEntry.create({
          data: {
            employeeId,
            categoryId: parsed.data.categoryId,
            payPeriodId: payPeriod?.id,
            entryDate: dayStart,
            startTime,
            endTime,
            durationMinutes: minutes,
            note: parsed.data.note,
            source: "MANUAL",
            status: "SUBMITTED",
          },
          include: { category: true },
        });

        results.push(entry);
      }

      return results;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit weekly timesheet.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ count: created.length, entries: created });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = (session.user as { employeeId?: string })?.employeeId;
  if (!employeeId) return NextResponse.json({ error: "No employee record" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error }, { status: 400 });
  }

  const requestedDays = parsed.data.days.filter((d) => d.minutes > 0);
  if (requestedDays.length === 0) {
    return NextResponse.json({ error: "Enter at least one day with time greater than 0." }, { status: 400 });
  }

  const dates = requestedDays.map((d) => startOfDay(parseISO(d.entryDate)));

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
    const approvedExisting = await tx.timeEntry.count({
      where: {
        employeeId,
        source: "MANUAL",
        status: "APPROVED",
        entryDate: { in: dates },
      },
    });

    if (approvedExisting > 0) {
      throw new Error("Cannot edit a weekly submission that already has approved entries.");
    }

    await tx.timeEntry.deleteMany({
      where: {
        employeeId,
        source: "MANUAL",
        status: { in: ["DRAFT", "SUBMITTED", "REJECTED"] },
        entryDate: { in: dates },
      },
    });

    const results = [];
    for (const day of requestedDays) {
      const entryDate = parseISO(day.entryDate);
      const minutes = day.minutes;
      const dayStart = startOfDay(entryDate);
      const defaultStart = setHours(dayStart, 9);

      const latestEntry = await tx.timeEntry.findFirst({
        where: {
          employeeId,
          entryDate: dayStart,
          status: { notIn: ["REJECTED"] },
        },
        orderBy: { endTime: "desc" },
      });

      if (latestEntry?.endTime === null) {
        throw new Error(`Cannot submit ${day.entryDate}: existing open entry has no end time.`);
      }

      const startTime =
        latestEntry?.endTime && latestEntry.endTime > defaultStart
          ? latestEntry.endTime
          : defaultStart;
      const endTime = addMinutes(startTime, minutes);

      const overlap = await tx.timeEntry.findFirst({
        where: {
          employeeId,
          status: { notIn: ["REJECTED"] },
          OR: [
            { startTime: { lte: startTime }, endTime: { gt: startTime } },
            { startTime: { lt: endTime }, endTime: { gte: endTime } },
            { startTime: { gte: startTime }, endTime: { lte: endTime } },
          ],
        },
      });

      if (overlap) {
        throw new Error(`Cannot submit ${day.entryDate}: hours overlap with another entry.`);
      }

      const payPeriod = await tx.payPeriod.findFirst({
        where: {
          startDate: { lte: dayStart },
          endDate: { gte: dayStart },
          status: "OPEN",
        },
      });

      const entry = await tx.timeEntry.create({
        data: {
          employeeId,
          categoryId: parsed.data.categoryId,
          payPeriodId: payPeriod?.id,
          entryDate: dayStart,
          startTime,
          endTime,
          durationMinutes: minutes,
          note: parsed.data.note,
          source: "MANUAL",
          status: "SUBMITTED",
        },
        include: { category: true },
      });

      results.push(entry);
    }

      return results;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resubmit weekly timesheet.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ count: created.length, entries: created, replaced: true });
}
