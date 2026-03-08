import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { parseISO } from "date-fns";
import { z } from "zod";

const expenseSchema = z.object({
  expenseDate: z.string().min(1),
  merchant: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional().nullable(),
  amount: z.number().positive(),
  isBillable: z.boolean().optional(),
  projectName: z.string().optional().nullable(),
  receiptImageUrl: z.string().optional().nullable(),
  payPeriodId: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "SUBMITTED"]).optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = (session.user as { employeeId?: string | null })?.employeeId;
  if (!employeeId) return NextResponse.json({ error: "No employee record" }, { status: 403 });

  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "current";

  const where =
    view === "submitted"
      ? { employeeId, status: { not: "DRAFT" as const } }
      : { employeeId, status: { in: ["DRAFT", "SUBMITTED"] as const } };

  const [expenses, payPeriods] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: { payPeriod: true },
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.payPeriod.findMany({
      orderBy: { startDate: "desc" },
      take: 20,
    }),
  ]);

  return NextResponse.json({ expenses, payPeriods });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = (session.user as { employeeId?: string | null })?.employeeId;
  if (!employeeId) return NextResponse.json({ error: "No employee record" }, { status: 403 });

  const body = await req.json();
  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error }, { status: 400 });
  }

  const data = parsed.data;
  const expenseDate = parseISO(data.expenseDate);
  if (Number.isNaN(expenseDate.getTime())) {
    return NextResponse.json({ error: "Invalid expense date" }, { status: 400 });
  }

  let payPeriodId = data.payPeriodId ?? null;
  if (!payPeriodId) {
    const period = await prisma.payPeriod.findFirst({
      where: {
        startDate: { lte: expenseDate },
        endDate: { gte: expenseDate },
      },
      orderBy: { startDate: "desc" },
    });
    payPeriodId = period?.id ?? null;
  }

  const expense = await prisma.expense.create({
    data: {
      employeeId,
      payPeriodId,
      expenseDate,
      merchant: data.merchant,
      category: data.category,
      description: data.description ?? null,
      amountCents: Math.round(data.amount * 100),
      isBillable: data.isBillable ?? false,
      projectName: data.projectName ?? null,
      receiptImageUrl: data.receiptImageUrl ?? null,
      status: data.status ?? "DRAFT",
    },
    include: { payPeriod: true },
  });

  return NextResponse.json(expense);
}
