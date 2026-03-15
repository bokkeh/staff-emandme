import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") redirect("/dashboard");

  const [settings, categories, employees, rawPayPeriods, auditLogs] = await Promise.all([
    prisma.appSettings.findFirst(),
    prisma.timeCategory.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.employee.findMany({
      orderBy: [{ lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        email: true,
        role: true,
        status: true,
        jobTitle: true,
        department: true,
        hourlyRateCents: true,
        managerId: true,
        birthMonth: true,
        birthDay: true,
        birthYear: true,
        startDate: true,
        phone: true,
        profilePhotoUrl: true,
        preferredWorkHours: true,
      },
    }),
    prisma.payPeriod.findMany({ orderBy: { startDate: "desc" }, take: 40 }),
    prisma.auditLog.findMany({
      include: { actor: { select: { id: true, firstName: true, lastName: true, preferredName: true, profilePhotoUrl: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  // Deduplicate pay periods by startDate (keeps the first/most-recent per start date)
  const seenStarts = new Set<string>();
  const payPeriods = rawPayPeriods.filter((p) => {
    const key = new Date(p.startDate).toISOString().split("T")[0];
    if (seenStarts.has(key)) return false;
    seenStarts.add(key);
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage categories, pay periods, and team members."
      />
      <SettingsClient
        settings={settings}
        categories={categories}
        employees={employees}
        payPeriods={payPeriods}
        auditLogs={auditLogs}
      />
    </div>
  );
}
