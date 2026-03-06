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
  managerId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  birthMonth: z.number().min(1).max(12).nullable().optional(),
  birthDay: z.number().min(1).max(31).nullable().optional(),
  birthYear: z.number().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  preferredWorkHours: z.string().nullable().optional(),
  profilePhotoUrl: z.string().nullable().optional(),
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

  // Staff cannot change role or status
  if (role === "STAFF") {
    delete data.role;
    delete data.status;
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
