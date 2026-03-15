import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  preferredName: z.string().nullable().optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  role: z.enum(["ADMIN", "MANAGER", "STAFF"]).optional(),
  jobTitle: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  hourlyRateCents: z.number().int().min(0).nullable().optional(),
  managerId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  birthMonth: z.number().min(1).max(12).nullable().optional(),
  birthDay: z.number().min(1).max(31).nullable().optional(),
  birthYear: z.number().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  preferredWorkHours: z.string().nullable().optional(),
  profilePhotoUrl: z.string().nullable().optional(),
  adminNotes: z.string().nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  const employeeId = (session.user as { employeeId?: string })?.employeeId;

  // Staff can only update their own basic info (not role/status)
  if (role === "STAFF" && employeeId !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const data = { ...parsed.data };

  // Staff cannot change role, status, or admin notes
  if (role === "STAFF") {
    delete data.role;
    delete data.status;
    delete data.hourlyRateCents;
    delete data.adminNotes;
  }

  if (data.startDate !== undefined) {
    (data as Record<string, unknown>).startDate = data.startDate ? new Date(data.startDate) : null;
  }

  const updated = await prisma.employee.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(_req.url);
  const mode = url.searchParams.get("mode") === "hard" ? "hard" : "soft";
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  const currentEmployeeId = (session.user as { employeeId?: string })?.employeeId;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (currentEmployeeId && currentEmployeeId === id) {
    return NextResponse.json({ error: "You cannot delete your own employee record." }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({ where: { id }, select: { id: true } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const [timeEntriesCount, activeTimerCount, payrollSummariesCount, reportsCount, approvedEntriesCount] =
    await Promise.all([
      prisma.timeEntry.count({ where: { employeeId: id } }),
      prisma.activeTimer.count({ where: { employeeId: id } }),
      prisma.payrollSummary.count({ where: { employeeId: id } }),
      prisma.employee.count({ where: { managerId: id } }),
      prisma.timeEntry.count({ where: { approvedById: id } }),
    ]);

  const hasLinkedRecords =
    timeEntriesCount > 0 ||
    activeTimerCount > 0 ||
    payrollSummariesCount > 0 ||
    reportsCount > 0 ||
    approvedEntriesCount > 0;

  if (mode === "hard" && hasLinkedRecords) {
    return NextResponse.json(
      {
        error:
          "Hard delete blocked: employee has linked records. Use 'Set Inactive' or remove linked records first.",
        details: {
          timeEntriesCount,
          activeTimerCount,
          payrollSummariesCount,
          reportsCount,
          approvedEntriesCount,
        },
      },
      { status: 409 }
    );
  }

  if (mode === "soft") {
    const softDeleted = await prisma.employee.update({
      where: { id },
      data: { status: "INACTIVE" },
      select: { id: true, status: true },
    });

    return NextResponse.json({
      ok: true,
      softDeleted: true,
      mode: "soft",
      employee: softDeleted,
      message: "Employee set to INACTIVE.",
      details: {
        timeEntriesCount,
        activeTimerCount,
        payrollSummariesCount,
        reportsCount,
        approvedEntriesCount,
      },
    });
  }

  await prisma.employee.delete({ where: { id } });
  return NextResponse.json({ ok: true, softDeleted: false, mode: "hard", deletedId: id });
}
