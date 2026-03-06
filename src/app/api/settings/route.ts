import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  payPeriodType: z.enum(["WEEKLY", "BIWEEKLY", "SEMIMONTHLY"]).optional(),
  overtimeWeeklyHours: z.number().min(1).max(168).optional(),
  birthdaysVisibleToAll: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await prisma.appSettings.findFirst();
  return NextResponse.json(settings ?? { payPeriodType: "BIWEEKLY", overtimeWeeklyHours: 40, birthdaysVisibleToAll: false });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const existing = await prisma.appSettings.findFirst();
  const settings = existing
    ? await prisma.appSettings.update({ where: { id: existing.id }, data: parsed.data })
    : await prisma.appSettings.create({ data: { ...parsed.data, updatedAt: new Date() } });

  return NextResponse.json(settings);
}
