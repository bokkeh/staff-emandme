import { auth } from "@/lib/auth";
import { ensurePayPeriodForDate } from "@/lib/payroll";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { addMinutes, parseISO, setHours, startOfDay } from "date-fns";

const schema = z.object({
  categoryId: z.string().min(1),
  note: z.string().optional(),
  employeeId: z.string().optional(), // admin/manager can specify target employee
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

  const sessionEmployeeId = (session.user as { employeeId?: string })?.employeeId;
  const role = (session.user as { role?: string })?.role;
  if (!sessionEmployeeId) return NextResponse.json({ error: "No employee record" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error }, { status: 400 });
  }

  const employeeId =
    parsed.data.employeeId && (role === "ADMIN" || role === "MANAGER")
      ? parsed.data.employeeId
      : sessionEmployeeId;

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

        const payPeriod = await ensurePayPeriodForDate(tx, dayStart);

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

  const sessionEmployeeId = (session.user as { employeeId?: string })?.employeeId;
  const role = (session.user as { role?: string })?.role;
  if (!sessionEmployeeId) return NextResponse.json({ error: "No employee record" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error }, { status: 400 });
  }

  const employeeId =
    parsed.data.employeeId && (role === "ADMIN" || role === "MANAGER")
      ? parsed.data.employeeId
      : sessionEmployeeId;

  const requestedDays = parsed.data.days.filter((d) => d.minutes > 0);
  if (requestedDays.length === 0) {
    return NextResponse.json({ error: "Enter at least one day with time greater than 0." }, { status: 400 });
  }

  const payloadDays = parsed.data.days.map((d) => ({
    ...d,
    dayStart: startOfDay(parseISO(d.entryDate)),
  }));

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      const existingEntries = await tx.timeEntry.findMany({
        where: {
          employeeId,
          source: "MANUAL",
          entryDate: { in: payloadDays.map((d) => d.dayStart) },
        },
        include: { category: true },
        orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
      });

      const existingByDay = new Map<string, typeof existingEntries>();
      for (const entry of existingEntries) {
        const key = entry.entryDate.toISOString().slice(0, 10);
        const current = existingByDay.get(key) ?? [];
        current.push(entry);
        existingByDay.set(key, current);
      }

      for (const day of payloadDays) {
        const key = day.dayStart.toISOString().slice(0, 10);
        const dayEntries = existingByDay.get(key) ?? [];
        if (dayEntries.length > 1) {
          throw new Error(
            `Cannot update ${day.entryDate}: this day has multiple manual entries. Edit the entries individually instead.`
          );
        }
      }

      const results = [];
      for (const day of payloadDays) {
        const key = day.dayStart.toISOString().slice(0, 10);
        const existing = (existingByDay.get(key) ?? [])[0];
        const minutes = day.minutes;
        const dayStart = day.dayStart;

        if (minutes <= 0) {
          if (existing) {
            if (existing.status === "APPROVED") {
              throw new Error(
                `Cannot remove approved time on ${day.entryDate} from the weekly editor. Edit that entry directly instead.`
              );
            }
            await tx.timeEntry.delete({ where: { id: existing.id } });
          }
          continue;
        }

        const defaultStart = setHours(dayStart, 9);

        const latestEntry = await tx.timeEntry.findFirst({
          where: {
            employeeId,
            entryDate: dayStart,
            status: { notIn: ["REJECTED"] },
            ...(existing ? { id: { not: existing.id } } : {}),
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
            ...(existing ? { id: { not: existing.id } } : {}),
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

        const payPeriod = await ensurePayPeriodForDate(tx, dayStart);
        const normalizedNote = parsed.data.note ?? null;
        const isChanged =
          !existing ||
          existing.categoryId !== parsed.data.categoryId ||
          existing.durationMinutes !== minutes ||
          (existing.note ?? null) !== normalizedNote ||
          existing.startTime.getTime() !== startTime.getTime() ||
          (existing.endTime?.getTime() ?? null) !== endTime.getTime() ||
          existing.payPeriodId !== (payPeriod?.id ?? null);

        const baseData = {
          categoryId: parsed.data.categoryId,
          payPeriodId: payPeriod?.id,
          entryDate: dayStart,
          startTime,
          endTime,
          durationMinutes: minutes,
          note: normalizedNote,
          source: "MANUAL" as const,
        };

        const entry = existing && !isChanged
          ? existing
          : existing
          ? await tx.timeEntry.update({
              where: { id: existing.id },
              data: {
                ...baseData,
                status: "SUBMITTED",
                approvedById: existing.status === "APPROVED" ? null : existing.approvedById,
                approvedAt: existing.status === "APPROVED" ? null : existing.approvedAt,
                rejectionReason: null,
              },
              include: { category: true },
            })
          : await tx.timeEntry.create({
              data: {
                employeeId,
                ...baseData,
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
