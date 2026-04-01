import { auth } from "@/lib/auth";
import { ensurePayPeriodForDate } from "@/lib/payroll";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

import { differenceInMinutes, parseISO } from "date-fns";

const updateSchema = z.object({
  status: z.enum(["SUBMITTED", "APPROVED", "REJECTED", "DRAFT"]).optional(),
  rejectionReason: z.string().optional(),
  editNote: z.string().optional(),
  note: z.string().optional(),
  // Full field edits (admin/manager only)
  categoryId: z.string().optional(),
  entryDate: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = (session.user as { employeeId?: string })?.employeeId;
  const role = (session.user as { role?: string })?.role;

  const entry = await prisma.timeEntry.findUnique({ where: { id } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Staff can only update their own non-approved entries
  if (role === "STAFF" && (entry.employeeId !== employeeId || entry.status === "APPROVED")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const updateData: Record<string, unknown> = {};

  // Status/note fields available to all
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.rejectionReason !== undefined) updateData.rejectionReason = parsed.data.rejectionReason;
  if (parsed.data.editNote !== undefined) updateData.editNote = parsed.data.editNote;
  if (parsed.data.note !== undefined) updateData.note = parsed.data.note;

  if (parsed.data.status === "APPROVED" && (role === "ADMIN" || role === "MANAGER")) {
    updateData.approvedById = employeeId;
    updateData.approvedAt = new Date();
  }

  // Full field edits for admin/manager only
  if (role === "ADMIN" || role === "MANAGER") {
    if (parsed.data.categoryId) updateData.categoryId = parsed.data.categoryId;

    if (parsed.data.startTime && parsed.data.endTime) {
      const startTime = parseISO(parsed.data.startTime);
      const endTime = parseISO(parsed.data.endTime);
      if (endTime <= startTime) {
        return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
      }
      updateData.startTime = startTime;
      updateData.endTime = endTime;
      updateData.durationMinutes = differenceInMinutes(endTime, startTime);
      updateData.source = "ADMIN_EDIT";
    }

    if (parsed.data.entryDate) {
      updateData.entryDate = parseISO(parsed.data.entryDate);
      // Re-assign pay period
      const entryDate = parseISO(parsed.data.entryDate);
      const payPeriod = await ensurePayPeriodForDate(prisma, entryDate);
      updateData.payPeriodId = payPeriod?.id ?? null;
    }
  }

  const updated = await prisma.timeEntry.update({
    where: { id },
    data: updateData,
    include: { category: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = (session.user as { employeeId?: string })?.employeeId;
  const role = (session.user as { role?: string })?.role;

  const entry = await prisma.timeEntry.findUnique({ where: { id } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (role === "STAFF" && (entry.employeeId !== employeeId || entry.status === "APPROVED")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.timeEntry.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
