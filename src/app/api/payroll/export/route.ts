import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { format } from "date-fns";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const payPeriodId = url.searchParams.get("payPeriodId");

  if (!payPeriodId) return NextResponse.json({ error: "payPeriodId required" }, { status: 400 });

  const payPeriod = await prisma.payPeriod.findUnique({ where: { id: payPeriodId } });
  if (!payPeriod) return NextResponse.json({ error: "Pay period not found" }, { status: 404 });

  const employees = await prisma.employee.findMany({
    where: { status: "ACTIVE" },
    include: {
      timeEntries: {
        where: { payPeriodId },
        include: { category: true },
      },
    },
    orderBy: { lastName: "asc" },
  });

  const rows = employees.map((emp) => {
    const allMinutes = emp.timeEntries.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
    const approvedMinutes = emp.timeEntries
      .filter((e) => e.status === "APPROVED")
      .reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
    const pendingMinutes = emp.timeEntries
      .filter((e) => e.status === "SUBMITTED")
      .reduce((s, e) => s + (e.durationMinutes ?? 0), 0);

    const regularMinutes = Math.min(allMinutes, 40 * 60);
    const overtimeMinutes = Math.max(0, allMinutes - 40 * 60);

    return {
      "Last Name": emp.lastName,
      "First Name": emp.firstName,
      "Preferred Name": emp.preferredName ?? "",
      Email: emp.email,
      Role: emp.role,
      "Job Title": emp.jobTitle ?? "",
      Department: emp.department ?? "",
      "Pay Period Start": format(payPeriod.startDate, "yyyy-MM-dd"),
      "Pay Period End": format(payPeriod.endDate, "yyyy-MM-dd"),
      "Total Hours": (allMinutes / 60).toFixed(2),
      "Regular Hours": (regularMinutes / 60).toFixed(2),
      "Overtime Hours": (overtimeMinutes / 60).toFixed(2),
      "Approved Hours": (approvedMinutes / 60).toFixed(2),
      "Pending Hours": (pendingMinutes / 60).toFixed(2),
      "Entry Count": emp.timeEntries.length,
    };
  });

  const headers = Object.keys(rows[0] ?? {});
  const csvRows = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = String((row as Record<string, string | number>)[h] ?? "");
          return val.includes(",") ? `"${val}"` : val;
        })
        .join(",")
    ),
  ];

  const csv = csvRows.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="payroll-${format(payPeriod.startDate, "yyyy-MM-dd")}.csv"`,
    },
  });
}
