import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { displayName, initials } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { TimesheetManager } from "./timesheet-manager";

export const dynamic = "force-dynamic";

const ROLE_COLORS = {
  ADMIN: "bg-primary/10 text-primary border-primary/20",
  MANAGER: "bg-blue-50 text-blue-700 border-blue-200",
  STAFF: "bg-muted text-muted-foreground border-border",
};

export default async function TimesheetPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const currentUserRole = (session.user as { role?: string })?.role ?? "";
  const currentEmployeeId = (session.user as { employeeId?: string })?.employeeId;

  // Staff can only view their own timesheet
  if (currentUserRole === "STAFF" && currentEmployeeId !== employeeId) {
    redirect("/time");
  }

  const [employee, categories] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        jobTitle: true,
        role: true,
        status: true,
        profilePhotoUrl: true,
      },
    }),
    prisma.timeCategory.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  if (!employee) notFound();

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/team/${employeeId}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to profile
        </Link>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <Avatar className="w-12 h-12">
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {initials(displayName(employee))}
          </AvatarFallback>
        </Avatar>
        <div>
          <PageHeader
            title={`${displayName(employee)}'s Timesheet`}
            description={employee.jobTitle ?? "Team Member"}
          />
        </div>
        <Badge
          variant="outline"
          className={cn("text-xs ml-auto", ROLE_COLORS[employee.role as keyof typeof ROLE_COLORS] ?? "")}
        >
          {employee.role.charAt(0) + employee.role.slice(1).toLowerCase()}
        </Badge>
      </div>

      <TimesheetManager
        targetEmployeeId={employeeId}
        categories={categories}
        userRole={currentUserRole}
      />
    </div>
  );
}
