import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  entryIds: z.array(z.string()),
  action: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  const employeeId = (session.user as { employeeId?: string })?.employeeId;

  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const updateData =
    parsed.data.action === "APPROVED"
      ? {
          status: "APPROVED" as const,
          approvedById: employeeId,
          approvedAt: new Date(),
        }
      : {
          status: "REJECTED" as const,
          rejectionReason: parsed.data.rejectionReason ?? "No reason provided",
        };

  await prisma.timeEntry.updateMany({
    where: {
      id: { in: parsed.data.entryIds },
      status: "SUBMITTED",
    },
    data: updateData,
  });

  return NextResponse.json({ success: true, count: parsed.data.entryIds.length });
}
