import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, formatMinutes, displayName, initials, getUpcomingBirthdays, formatDate } from "@/lib/utils";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { Clock, Users, DollarSign, ArrowRight, Cake } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const employeeId = (session.user as { employeeId?: string })?.employeeId;
  const role = (session.user as { role?: string })?.role;
  const userName = session.user?.name ?? "there";

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const [activeTimer, weekEntries, currentPeriod, allEmployees, pendingApprovals] =
    await Promise.all([
      employeeId
        ? prisma.activeTimer.findUnique({
            where: { employeeId },
            include: { category: true },
          })
        : null,
      employeeId
        ? prisma.timeEntry.findMany({
            where: {
              employeeId,
              entryDate: { gte: weekStart, lte: weekEnd },
            },
          })
        : [],
      prisma.payPeriod.findFirst({
        where: { status: "OPEN" },
        orderBy: { startDate: "desc" },
      }),
      prisma.employee.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          preferredName: true,
          birthMonth: true,
          birthDay: true,
          profilePhotoUrl: true,
        },
      }),
      role === "ADMIN" || role === "MANAGER"
        ? prisma.timeEntry.count({ where: { status: "SUBMITTED" } })
        : Promise.resolve(0),
    ]);

  const weekMinutes = weekEntries.reduce(
    (s: number, e: { durationMinutes: number | null }) => s + (e.durationMinutes ?? 0),
    0
  );

  const periodSummary = employeeId && currentPeriod
    ? await prisma.payrollSummary.findUnique({
        where: { employeeId_payPeriodId: { employeeId, payPeriodId: currentPeriod.id } },
      })
    : null;

  const settings = await prisma.appSettings.findFirst();
  const birthdaysVisibleToAll = settings?.birthdaysVisibleToAll ?? false;
  const canSeeBirthdays = birthdaysVisibleToAll || role === "ADMIN" || role === "MANAGER";

  const upcomingBirthdays = canSeeBirthdays
    ? getUpcomingBirthdays(allEmployees, 30)
    : [];

  const todayBirthdays = upcomingBirthdays.filter((b) => b.isToday);
  const soonBirthdays = upcomingBirthdays.filter((b) => !b.isToday && b.daysUntil <= 7);

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Good {getTimeOfDay()}, {userName.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {format(now, "EEEE, MMMM d")}
        </p>
      </div>

      {/* Birthday alerts */}
      {todayBirthdays.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-amber-800">
            <Cake className="w-5 h-5" />
            <p className="font-medium">
              {todayBirthdays.map((b) => displayName(b)).join(", ")}
              {todayBirthdays.length === 1 ? " has" : " have"} a birthday today!
            </p>
          </div>
        </div>
      )}

      {/* Status row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Clock in status */}
        <Card className={cn(activeTimer && "border-primary/30 bg-primary/5")}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Status</p>
                {activeTimer ? (
                  <>
                    <p className="font-semibold text-primary">Clocked In</p>
                    <p className="text-xs text-muted-foreground mt-1">{activeTimer.category.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Since {format(new Date(activeTimer.startedAt), "h:mm a")}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-muted-foreground">Clocked Out</p>
                    <p className="text-xs text-muted-foreground mt-1">Not tracking time</p>
                  </>
                )}
              </div>
              <Clock className={cn("w-5 h-5 mt-0.5", activeTimer ? "text-primary" : "text-muted-foreground")} />
            </div>
          </CardContent>
        </Card>

        {/* This week */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">This Week</p>
            <p className="text-2xl font-semibold">{formatMinutes(weekMinutes)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {(weekMinutes / 60).toFixed(1)}h logged
            </p>
          </CardContent>
        </Card>

        {/* Pay period */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Pay Period</p>
            {currentPeriod ? (
              <>
                <p className="text-2xl font-semibold">
                  {formatMinutes(periodSummary?.approvedMinutes ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDate(currentPeriod.startDate)} — {formatDate(currentPeriod.endDate)}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">No active period</p>
            )}
          </CardContent>
        </Card>

        {/* Manager: pending approvals */}
        {(role === "ADMIN" || role === "MANAGER") && (
          <Card className={cn(pendingApprovals > 0 && "border-amber-200 bg-amber-50")}>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Pending Approvals</p>
              <p className={cn("text-2xl font-semibold", pendingApprovals > 0 && "text-amber-700")}>
                {pendingApprovals}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {pendingApprovals === 1 ? "entry" : "entries"} to review
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick links + birthdays */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick actions */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: "Track Time", href: "/time", icon: Clock, description: "Clock in or log hours" },
                { label: "Team Directory", href: "/team", icon: Users, description: "View the team" },
                ...(role === "ADMIN" || role === "MANAGER"
                  ? [{ label: "Payroll", href: "/payroll", icon: DollarSign, description: "Review & approve" }]
                  : []),
              ].map((link) => (
                <Link key={link.href} href={link.href}>
                  <div className="p-4 rounded-xl border bg-card hover:border-primary/30 hover:bg-primary/5 transition-all group cursor-pointer">
                    <link.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors mb-2" />
                    <p className="font-medium text-sm group-hover:text-primary transition-colors">{link.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{link.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming birthdays */}
        {canSeeBirthdays && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Cake className="w-4 h-4" />
                Upcoming Birthdays
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {upcomingBirthdays.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No birthdays in the next 30 days.
                </p>
              ) : (
                <div className="space-y-2">
                  {upcomingBirthdays.slice(0, 5).map((person) => (
                    <Link
                      key={person.id}
                      href={`/team/${person.id}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors"
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={person.profilePhotoUrl ?? undefined} />
                        <AvatarFallback className="bg-amber-100 text-amber-700 text-xs font-medium">
                          {initials(displayName(person))}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{displayName(person)}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(2000, person.birthMonth - 1, person.birthDay).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" }
                          )}
                        </p>
                      </div>
                      {person.isToday ? (
                        <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200">Today!</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {person.daysUntil === 1 ? "Tomorrow" : `${person.daysUntil}d`}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
