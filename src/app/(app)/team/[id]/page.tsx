import { auth } from "@/lib/auth";
import { ensureCurrentPayPeriod } from "@/lib/payroll";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { displayName, initials, formatDate, formatMinutes } from "@/lib/utils";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, Calendar, Cake, DollarSign } from "lucide-react";
import { startOfWeek, endOfWeek } from "date-fns";
import { TeamMemberEdit } from "./team-member-edit";
import { TimesheetManager } from "@/app/(app)/timesheets/[employeeId]/timesheet-manager";

export const dynamic = "force-dynamic";

const ROLE_COLORS = {
  ADMIN: "bg-primary/10 text-primary border-primary/20",
  MANAGER: "bg-blue-50 text-blue-700 border-blue-200",
  STAFF: "bg-muted text-muted-foreground border-border",
};

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const currentUserRole = (session?.user as { role?: string })?.role;

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      manager: true,
      reports: {
        where: { status: "ACTIVE" },
        select: { id: true, firstName: true, lastName: true, preferredName: true, jobTitle: true, profilePhotoUrl: true },
      },
    },
  });

  if (!employee) notFound();

  const allEmployees =
    currentUserRole === "ADMIN"
      ? await prisma.employee.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, firstName: true, lastName: true, preferredName: true },
          orderBy: { firstName: "asc" },
        })
      : [];

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const [recentEntries, categories, currentPeriod] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { employeeId: id, entryDate: { gte: weekStart, lte: weekEnd } },
      select: { durationMinutes: true },
    }),
    prisma.timeCategory.findMany({ orderBy: { sortOrder: "asc" } }),
    ensureCurrentPayPeriod(prisma),
  ]);

  const weekMinutes = recentEntries
    .reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);

  const periodSummary = currentPeriod
    ? await prisma.payrollSummary.findUnique({
        where: { employeeId_payPeriodId: { employeeId: id, payPeriodId: currentPeriod.id } },
      })
    : null;

  const birthdayDisplay =
    employee.birthMonth && employee.birthDay
      ? new Date(2000, employee.birthMonth - 1, employee.birthDay).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
        })
      : null;

  const canSeeBirthday =
    currentUserRole === "ADMIN" ||
    currentUserRole === "MANAGER" ||
    (session?.user as { employeeId?: string })?.employeeId === id;
  const canSeeRate = currentUserRole === "ADMIN";

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/team"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to directory
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile card */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            {currentUserRole === "ADMIN" && (
              <div className="flex justify-end px-6 pt-4 pb-0">
                <TeamMemberEdit employee={employee} allEmployees={allEmployees} />
              </div>
            )}
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <Avatar className="w-20 h-20 ring-4 ring-background shadow-md">
                  <AvatarImage src={employee.profilePhotoUrl ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                    {initials(displayName(employee))}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-semibold">{displayName(employee)}</h2>
                  {employee.preferredName && (
                    <p className="text-sm text-muted-foreground">
                      {employee.firstName} {employee.lastName}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">
                    {employee.jobTitle ?? "Team Member"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge
                    variant="outline"
                    className={cn("text-xs", ROLE_COLORS[employee.role])}
                  >
                    {employee.role.charAt(0) + employee.role.slice(1).toLowerCase()}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      employee.status === "ACTIVE"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {employee.status.charAt(0) + employee.status.slice(1).toLowerCase()}
                  </Badge>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4 shrink-0" />
                  <a href={`mailto:${employee.email}`} className="hover:text-foreground transition-colors truncate">
                    {employee.email}
                  </a>
                </div>
                {employee.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4 shrink-0" />
                    <span>{employee.phone}</span>
                  </div>
                )}
                {employee.startDate && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span>Joined {formatDate(employee.startDate)}</span>
                  </div>
                )}
                {canSeeBirthday && birthdayDisplay && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Cake className="w-4 h-4 shrink-0" />
                    <span>{birthdayDisplay}</span>
                  </div>
                )}
                {canSeeRate && employee.hourlyRateCents != null && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <DollarSign className="w-4 h-4 shrink-0" />
                    <span>${(employee.hourlyRateCents / 100).toFixed(2)}/hr</span>
                  </div>
                )}
              </div>

              {employee.department && (
                <>
                  <Separator className="my-4" />
                  <div className="text-sm">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Department</p>
                    <p>{employee.department}</p>
                  </div>
                </>
              )}

              {employee.manager && (
                <>
                  <Separator className="my-4" />
                  <div className="text-sm">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Reports To</p>
                    <Link href={`/team/${employee.manager.id}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                      <Avatar className="w-7 h-7">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {initials(displayName(employee.manager))}
                        </AvatarFallback>
                      </Avatar>
                      <span>{displayName(employee.manager)}</span>
                    </Link>
                  </div>
                </>
              )}
              {(currentUserRole === "ADMIN" || currentUserRole === "MANAGER") && employee.adminNotes && (
                <>
                  <Separator className="my-4" />
                  <div className="text-sm">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Admin Notes</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{employee.adminNotes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Reports */}
          {employee.reports.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Direct Reports ({employee.reports.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {employee.reports.map((r) => (
                  <Link
                    key={r.id}
                    href={`/team/${r.id}`}
                    className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                  >
                    <Avatar className="w-7 h-7">
                      <AvatarImage src={r.profilePhotoUrl ?? undefined} />
                      <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                        {initials(displayName(r))}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium leading-none">{displayName(r)}</p>
                      {r.jobTitle && <p className="text-xs text-muted-foreground">{r.jobTitle}</p>}
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Pay period snapshot */}
          {(currentUserRole === "ADMIN" || currentUserRole === "MANAGER" || (session?.user as { employeeId?: string })?.employeeId === id) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  {currentPeriod ? (
                    <>Current Pay Period — {formatDate(currentPeriod.startDate)} to {formatDate(currentPeriod.endDate)}</>
                  ) : (
                    "Pay Period"
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {periodSummary ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { label: "Approved", value: periodSummary.approvedMinutes, color: "text-green-600" },
                        { label: "Pending", value: periodSummary.pendingMinutes, color: "text-amber-600" },
                        { label: "Overtime", value: periodSummary.overtimeMinutes, color: "text-orange-600" },
                        { label: "This Week", value: weekMinutes, color: "text-foreground" },
                      ].map((stat) => (
                        <div key={stat.label} className="text-center p-3 rounded-lg bg-muted/40">
                          <p className={cn("text-xl font-semibold", stat.color)}>
                            {formatMinutes(stat.value)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                        </div>
                      ))}
                    </div>
                    {canSeeRate && employee.hourlyRateCents != null && (
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 text-sm">
                        <span className="text-muted-foreground">Est. Payout (approved)</span>
                        <span className="font-semibold text-green-700">
                          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                            (periodSummary.approvedMinutes / 60) * (employee.hourlyRateCents / 100)
                          )}
                        </span>
                      </div>
                    )}
                    {canSeeRate && employee.hourlyRateCents != null && periodSummary.pendingMinutes > 0 && (
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50 border border-amber-100 text-sm">
                        <span className="text-muted-foreground">Est. Payout (if all approved)</span>
                        <span className="font-semibold text-amber-700">
                          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                            ((periodSummary.approvedMinutes + periodSummary.pendingMinutes) / 60) * (employee.hourlyRateCents / 100)
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
                    <div className="text-center p-3 rounded-lg bg-muted/40">
                      <p className="text-xl font-semibold">{formatMinutes(weekMinutes)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">This Week</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Timesheet */}
          <TimesheetManager
            targetEmployeeId={id}
            categories={categories}
            userRole={currentUserRole ?? "STAFF"}
          />
        </div>
      </div>
    </div>
  );
}
