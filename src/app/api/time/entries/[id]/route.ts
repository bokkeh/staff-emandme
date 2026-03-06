import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["SUBMITTED", "APPROVED", "REJECTED", "DRAFT"]).optional(),
  rejectionReason: z.string().optional(),
  editNote: z.string().optional(),
  note: z.string().optional(),
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

  const updateData: Record<string, unknown> = { ...parsed.data };

  if (parsed.data.status === "APPROVED" && (role === "ADMIN" || role === "MANAGER")) {
    updateData.approvedById = employeeId;
    updateData.approvedAt = new Date();
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
