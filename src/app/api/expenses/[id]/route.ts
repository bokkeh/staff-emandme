import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { parseISO } from "date-fns";
import { z } from "zod";

const updateSchema = z.object({
  expenseDate: z.string().optional(),
  merchant: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  amount: z.number().positive().optional(),
  isBillable: z.boolean().optional(),
  projectName: z.string().nullable().optional(),
  receiptImageUrl: z.string().nullable().optional(),
  payPeriodId: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REIMBURSED", "REJECTED"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = (session.user as { employeeId?: string | null })?.employeeId;
  const role = (session.user as { role?: string | null })?.role;
  if (!employeeId) return NextResponse.json({ error: "No employee record" }, { status: 403 });

  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.employeeId !== employeeId && role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error }, { status: 400 });
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {
    merchant: data.merchant,
    category: data.category,
    description: data.description,
    isBillable: data.isBillable,
    projectName: data.projectName,
    receiptImageUrl: data.receiptImageUrl,
    status: data.status,
    payPeriodId: data.payPeriodId,
  };

  if (data.amount != null) {
    updateData.amountCents = Math.round(data.amount * 100);
  }

  if (data.expenseDate) {
    const expenseDate = parseISO(data.expenseDate);
    if (Number.isNaN(expenseDate.getTime())) {
      return NextResponse.json({ error: "Invalid expense date" }, { status: 400 });
    }
    updateData.expenseDate = expenseDate;

    if (!data.payPeriodId) {
      const period = await prisma.payPeriod.findFirst({
        where: {
          startDate: { lte: expenseDate },
          endDate: { gte: expenseDate },
        },
        orderBy: { startDate: "desc" },
      });
      updateData.payPeriodId = period?.id ?? null;
    }
  }

  const updated = await prisma.expense.update({
    where: { id },
    data: updateData,
    include: { payPeriod: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = (session.user as { employeeId?: string | null })?.employeeId;
  const role = (session.user as { role?: string | null })?.role;
  if (!employeeId) return NextResponse.json({ error: "No employee record" }, { status: 403 });

  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.employeeId !== employeeId && role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.expense.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
