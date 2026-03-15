import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { addDays, parseISO } from "date-fns";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const periods = await prisma.payPeriod.findMany({
    orderBy: { startDate: "desc" },
    take: 20,
  });

  return NextResponse.json(periods);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Find the most recent period to compute the next start date
  const latest = await prisma.payPeriod.findFirst({
    orderBy: { endDate: "desc" },
  });

  let startDate: Date;
  if (latest) {
    startDate = addDays(latest.endDate, 1);
  } else {
    // No periods exist: start today (Monday-aligned is nice but not required)
    const body = await req.json().catch(() => ({}));
    startDate = body.startDate ? parseISO(body.startDate) : new Date();
    startDate.setHours(0, 0, 0, 0);
  }

  const endDate = addDays(startDate, 13); // 14-day biweekly period

  // Check if an OPEN period already exists overlapping these dates
  const conflict = await prisma.payPeriod.findFirst({
    where: {
      status: "OPEN",
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });

  if (conflict) {
    return NextResponse.json(
      { error: "An open pay period already covers these dates." },
      { status: 409 }
    );
  }

  const period = await prisma.payPeriod.create({
    data: { startDate, endDate, type: "BIWEEKLY", status: "OPEN" },
  });

  return NextResponse.json(period);
}
