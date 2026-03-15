import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseISO } from "date-fns";

const createSchema = z.object({
  type: z.enum(["VACATION", "SICK", "PERSONAL", "UNPAID", "OTHER"]).default("VACATION"),
  startDate: z.string(),
  endDate: z.string(),
  note: z.string().optional(),
  employeeId: z.string().optional(), // admin/manager can submit on behalf of employee
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = (session.user as { employeeId?: string })?.employeeId;
  const role = (session.user as { role?: string })?.role;

  const url = new URL(req.url);
  const targetId = url.searchParams.get("employeeId");

  const queryId =
    targetId && (role === "ADMIN" || role === "MANAGER") ? targetId : employeeId;

  if (!queryId) return NextResponse.json({ error: "No employee record" }, { status: 403 });

  // Managers/admins with no targetId see all requests
  const where =
    (role === "ADMIN" || role === "MANAGER") && !targetId
      ? {}
      : { employeeId: queryId };

  const requests = await prisma.timeOffRequest.findMany({
    where,
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, preferredName: true, profilePhotoUrl: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
    },
    orderBy: { startDate: "desc" },
  });

  return NextResponse.json(requests);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionEmployeeId = (session.user as { employeeId?: string })?.employeeId;
  const role = (session.user as { role?: string })?.role;
  if (!sessionEmployeeId) return NextResponse.json({ error: "No employee record" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error }, { status: 400 });

  const employeeId =
    parsed.data.employeeId && (role === "ADMIN" || role === "MANAGER")
      ? parsed.data.employeeId
      : sessionEmployeeId;

  const startDate = parseISO(parsed.data.startDate);
  const endDate = parseISO(parsed.data.endDate);

  if (endDate < startDate) {
    return NextResponse.json({ error: "End date must be on or after start date" }, { status: 400 });
  }

  const request = await prisma.timeOffRequest.create({
    data: {
      employeeId,
      type: parsed.data.type,
      startDate,
      endDate,
      note: parsed.data.note,
      status: "PENDING",
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, preferredName: true, profilePhotoUrl: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
    },
  });

  return NextResponse.json(request);
}
