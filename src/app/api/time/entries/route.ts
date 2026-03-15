import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { differenceInMinutes, parseISO } from "date-fns";

const createSchema = z.object({
  categoryId: z.string().min(1),
  entryDate: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  note: z.string().optional(),
  employeeId: z.string().optional(), // admin/manager can specify target employee
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionEmployeeId = (session.user as { employeeId?: string })?.employeeId;
  const role = (session.user as { role?: string })?.role;
  if (!sessionEmployeeId) return NextResponse.json({ error: "No employee record" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error }, { status: 400 });

  // Admin/manager can create entries for other employees
  const employeeId =
    parsed.data.employeeId && (role === "ADMIN" || role === "MANAGER")
      ? parsed.data.employeeId
      : sessionEmployeeId;

  const startTime = parseISO(parsed.data.startTime);
  const endTime = parseISO(parsed.data.endTime);
  const entryDate = parseISO(parsed.data.entryDate);

  if (endTime <= startTime) {
    return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
  }

  // Check for overlapping entries
  const overlap = await prisma.timeEntry.findFirst({
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
    return NextResponse.json({ error: "This entry overlaps with an existing entry" }, { status: 409 });
  }

  const duration = differenceInMinutes(endTime, startTime);
  const settings = await prisma.appSettings.findFirst();
  const flagThreshold = (settings?.overtimeWeeklyHours ?? 40) * 60;

  const now = new Date();
  const payPeriod = await prisma.payPeriod.findFirst({
    where: {
      startDate: { lte: entryDate },
      endDate: { gte: entryDate },
      status: "OPEN",
    },
  });

  const entry = await prisma.timeEntry.create({
    data: {
      employeeId,
      categoryId: parsed.data.categoryId,
      payPeriodId: payPeriod?.id,
      entryDate,
      startTime,
      endTime,
      durationMinutes: duration,
      note: parsed.data.note,
      source: "MANUAL",
      status: "DRAFT",
    },
    include: { category: true },
  });

  return NextResponse.json(entry);
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = (session.user as { employeeId?: string })?.employeeId;
  const role = (session.user as { role?: string })?.role;
  if (!employeeId) return NextResponse.json({ error: "No employee record" }, { status: 403 });

  const url = new URL(req.url);
  const targetEmployeeId = url.searchParams.get("employeeId");
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");

  // Only admin/manager can query other employees
  const queryEmployeeId =
    targetEmployeeId && (role === "ADMIN" || role === "MANAGER")
      ? targetEmployeeId
      : employeeId;

  const entries = await prisma.timeEntry.findMany({
    where: {
      employeeId: queryEmployeeId,
      ...(startDate && endDate && {
        entryDate: {
          gte: parseISO(startDate),
          lte: parseISO(endDate),
        },
      }),
    },
    include: {
      category: true,
      approvedBy: {
        select: { id: true, firstName: true, lastName: true, preferredName: true },
      },
    },
    orderBy: { startTime: "desc" },
  });

  return NextResponse.json(entries);
}
