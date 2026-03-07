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
  homeAddress: z.string().nullable().optional(),
  emergencyContactName: z.string().nullable().optional(),
  emergencyContactPhone: z.string().nullable().optional(),
  emergencyContactRelation: z.string().nullable().optional(),
  emergencyContactNotes: z.string().nullable().optional(),
  profilePhotoUrl: z.string().nullable().optional(),
  pets: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.string().min(1),
        breed: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        photoUrl: z.string().nullable().optional(),
      })
    )
    .optional(),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string | null })?.role ?? null;
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

  const { pets, ...employeeData } = parsed.data;
  const data = { ...employeeData };

  // Non-admin users cannot change internal work metadata.
  if (role !== "ADMIN") {
    delete (data as Record<string, unknown>).jobTitle;
    delete (data as Record<string, unknown>).department;
    delete (data as Record<string, unknown>).preferredWorkHours;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedEmployee = await tx.employee.update({
      where: { id: employee.id },
      data,
    });

    if (pets) {
      await tx.pet.deleteMany({ where: { employeeId: employee.id } });
      if (pets.length > 0) {
        await tx.pet.createMany({
          data: pets.map((pet) => ({
            employeeId: employee.id,
            name: pet.name,
            type: pet.type,
            breed: pet.breed ?? null,
            notes: pet.notes ?? null,
            photoUrl: pet.photoUrl ?? null,
          })),
        });
      }
    }

    const fullProfile = await tx.employee.findUnique({
      where: { id: employee.id },
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
        homeAddress: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        emergencyContactRelation: true,
        emergencyContactNotes: true,
        profilePhotoUrl: true,
        preferredWorkHours: true,
        createdAt: true,
        pets: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            type: true,
            breed: true,
            notes: true,
            photoUrl: true,
          },
        },
      },
    });

    return fullProfile ?? updatedEmployee;
  });

  return NextResponse.json(updated);
}
