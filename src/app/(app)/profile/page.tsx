import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileClient } from "./profile-client";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const employeeId = (session.user as { employeeId?: string | null })?.employeeId;
  const userId = (session.user as { id?: string })?.id;

  const employee = employeeId
    ? await prisma.employee.findUnique({
        where: { id: employeeId },
      })
    : userId
      ? await prisma.employee.findUnique({
          where: { userId },
        })
      : null;

  if (!employee) {
    return (
      <div>
        <PageHeader
          title="My Profile"
          description="Manage your personal information and preferences."
        />
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          No employee profile is linked to your account yet. Ask an admin to create or connect it.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="My Profile"
        description="Manage your personal information and preferences."
      />
      <ProfileClient employee={employee} />
    </div>
  );
}
