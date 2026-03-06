import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  categoryId: z.string().min(1),
  note: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = (session.user as { employeeId?: string })?.employeeId;
  if (!employeeId) return NextResponse.json({ error: "No employee record" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Check for existing active timer
  const existing = await prisma.activeTimer.findUnique({ where: { employeeId } });
  if (existing) {
    return NextResponse.json({ error: "Already clocked in" }, { status: 409 });
  }

  const timer = await prisma.activeTimer.create({
    data: {
      employeeId,
      categoryId: parsed.data.categoryId,
      note: parsed.data.note,
    },
    include: { category: true },
  });

  return NextResponse.json(timer);
}
