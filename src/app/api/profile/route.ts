import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const profileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  preferredName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  birthMonth: z.number().int().min(1).max(12).nullable().optional(),
  birthDay: z.number().int().min(1).max(31).nullable().optional(),
  birthYear: z.number().int().nullable().optional(),
  preferredWorkHours: z.string().nullable().optional(),
  profilePhotoUrl: z.string().nullable().optional(),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = (session.user as { employeeId?: string | null })?.employeeId;
  const userId = (session.user as { id?: string })?.id;

  const employee = employeeId
    ? await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } })
    : userId
      ? await prisma.employee.findUnique({ where: { userId }, select: { id: true } })
      : null;

  if (!employee) {
    return NextResponse.json({ error: "Employee profile not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error }, { status: 400 });
  }

  const updated = await prisma.employee.update({
    where: { id: employee.id },
    data: parsed.data,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      jobTitle: true,
      department: true,
      hourlyRateCents: true,
      startDate: true,
      birthMonth: true,
      birthDay: true,
      birthYear: true,
      profilePhotoUrl: true,
      preferredWorkHours: true,
      createdAt: true,
    },
  });

  return NextResponse.json(updated);
}
