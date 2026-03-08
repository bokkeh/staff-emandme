import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = (session.user as { employeeId?: string | null })?.employeeId;
  if (!employeeId) return NextResponse.json({ error: "No employee record" }, { status: 403 });

  const result = await prisma.expense.updateMany({
    where: {
      employeeId,
      status: "DRAFT",
    },
    data: {
      status: "SUBMITTED",
    },
  });

  return NextResponse.json({ count: result.count });
}
