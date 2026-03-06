"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, formatMinutes, formatDate, displayName, initials } from "@/lib/utils";
import { Download, CheckCheck, X } from "lucide-react";
import type { Employee, TimeEntry, TimeCategory, PayPeriod } from "@prisma/client";

type EntryWithRelations = TimeEntry & {
  employee: Employee;
  category: TimeCategory;
};

type EmployeeSummary = {
  employee: Employee;
  totalMinutes: number;
  approvedMinutes: number;
  pendingMinutes: number;
  rejectedMinutes: number;
  overtimeMinutes: number;
  entryCount: number;
};

function buildSummaries(employees: Employee[], entries: EntryWithRelations[]): EmployeeSummary[] {
  return employees.map((emp) => {
    const empEntries = entries.filter((e) => e.employeeId === emp.id);
    const total = empEntries.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
    const approved = empEntries.filter((e) => e.status === "APPROVED").reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
    const pending = empEntries.filter((e) => e.status === "SUBMITTED").reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
    const rejected = empEntries.filter((e) => e.status === "REJECTED").reduce((s, e) => s + (e.durationMinutes ?? 0), 0);

    return {
      employee: emp,
      totalMinutes: total,
      approvedMinutes: approved,
      pendingMinutes: pending,
      rejectedMinutes: rejected,
      overtimeMinutes: Math.max(0, total - 40 * 60),
      entryCount: empEntries.length,
    };
  });
}

function formatCurrencyFromCents(cents: number | null | undefined) {
  if (cents == null) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function PayrollClient({
  payPeriods,
  currentPeriod,
  employees,
  pendingEntries: initialPending,
  periodEntries: initialPeriodEntries,
  currentRole,
}: {
  payPeriods: PayPeriod[];
  currentPeriod: PayPeriod | null;
  employees: Employee[];
  pendingEntries: EntryWithRelations[];
  periodEntries: EntryWithRelations[];
  currentRole: string;
}) {
  const [pending, setPending] = useState(initialPending);
  const [periodEntries, setPeriodEntries] = useState(initialPeriodEntries);
  const [loading, setLoading] = useState(false);

  const summaries = buildSummaries(employees, periodEntries);
  const pendingGroups = useMemo(() => {
    const groups = new Map<string, { employee: Employee; entries: EntryWithRelations[]; totalMinutes: number }>();
    for (const entry of pending) {
      const current = groups.get(entry.employeeId);
      if (!current) {
        groups.set(entry.employeeId, {
          employee: entry.employee,
          entries: [entry],
          totalMinutes: entry.durationMinutes ?? 0,
        });
      } else {
        current.entries.push(entry);
        current.totalMinutes += entry.durationMinutes ?? 0;
      }
    }
    return Array.from(groups.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [pending]);

  const handleBatchAction = async (entryIds: string[], action: "APPROVED" | "REJECTED") => {
    if (entryIds.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/payroll/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryIds, action }),
      });
      if (!res.ok) {
        toast.error("Action failed");
        return;
      }
      const { count } = await res.json();
      toast.success(`${count} ${count === 1 ? "entry" : "entries"} ${action === "APPROVED" ? "approved" : "rejected"}`);
      const idSet = new Set(entryIds);
      setPending((prev) => prev.filter((e) => !idSet.has(e.id)));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!currentPeriod) return;
    window.open(`/api/payroll/export?payPeriodId=${currentPeriod.id}`, "_blank");
  };

  return (
    <Tabs defaultValue="approvals" className="flex-col">
      <div className="flex flex-col items-start gap-3 mb-4">
        <TabsList className="inline-flex w-fit rounded-full bg-muted p-1">
          <TabsTrigger value="approvals" className="rounded-full px-4">
            Pending Approvals
            {pending.length > 0 && (
              <span className="ml-1.5 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {pending.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="summary" className="rounded-full px-4">Period Summary</TabsTrigger>
        </TabsList>

        {currentRole === "ADMIN" && currentPeriod && (
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        )}
      </div>

      {currentPeriod && (
        <div className="mb-4 p-3 rounded-lg bg-muted/40 text-sm text-muted-foreground flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              currentPeriod.status === "OPEN" && "bg-green-50 text-green-700 border-green-200",
              currentPeriod.status === "CLOSED" && "bg-muted text-muted-foreground"
            )}
          >
            {currentPeriod.status}
          </Badge>
          <span>
            Pay period: {formatDate(currentPeriod.startDate)} - {formatDate(currentPeriod.endDate)}
          </span>
        </div>
      )}

      <TabsContent value="approvals">
        {pending.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              No pending time entries to review.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                {pendingGroups.length} {pendingGroups.length === 1 ? "timesheet" : "timesheets"} awaiting review
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {pendingGroups.map((group) => {
                  const rateCents = group.employee.hourlyRateCents;
                  const estimateCents =
                    rateCents == null ? null : Math.round((group.totalMinutes * rateCents) / 60);
                  return (
                  <div key={group.employee.id} className="rounded-xl border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarImage src={group.employee.profilePhotoUrl ?? undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {initials(displayName(group.employee))}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{displayName(group.employee)}</p>
                          <p className="text-xs text-muted-foreground">
                            {group.entries.length} {group.entries.length === 1 ? "entry" : "entries"} submitted
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatMinutes(group.totalMinutes)}</p>
                        <p className="text-xs text-muted-foreground">Pending total</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Est. pay: <span className="font-medium text-foreground">{formatCurrencyFromCents(estimateCents)}</span>
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {group.entries.slice(0, 6).map((entry) => (
                        <div key={entry.id} className="rounded-lg bg-background border p-2">
                          <p className="text-xs font-medium">{formatDate(entry.entryDate)}</p>
                          <p className="text-xs text-muted-foreground">{entry.category.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.startTime && entry.endTime
                              ? `${format(new Date(entry.startTime), "h:mm a")} - ${format(new Date(entry.endTime), "h:mm a")}`
                              : ""}
                          </p>
                          <p className="text-xs font-semibold mt-1">{formatMinutes(entry.durationMinutes ?? 0)}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-green-700 border-green-200 hover:bg-green-50"
                        onClick={() => handleBatchAction(group.entries.map((e) => e.id), "APPROVED")}
                        disabled={loading}
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Approve Timesheet
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleBatchAction(group.entries.map((e) => e.id), "REJECTED")}
                        disabled={loading}
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject Timesheet
                      </Button>
                    </div>

                    {group.entries.length > 6 && (
                      <p className="text-xs text-muted-foreground">+{group.entries.length - 6} more entries in this submission</p>
                    )}
                  </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="summary">
        <Card>
          <CardContent className="pt-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Employee</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Total</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Regular</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">OT</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Approved</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Est. Payout</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Pending</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Entries</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s, i) => (
                  <tr key={s.employee.id} className={cn("hover:bg-muted/20", i !== summaries.length - 1 && "border-b")}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-7 h-7">
                          <AvatarImage src={s.employee.profilePhotoUrl ?? undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {initials(displayName(s.employee))}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{displayName(s.employee)}</p>
                          <p className="text-xs text-muted-foreground">{s.employee.jobTitle ?? s.employee.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatMinutes(s.totalMinutes)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">{formatMinutes(Math.min(s.totalMinutes, 40 * 60))}</td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      {s.overtimeMinutes > 0 ? <span className="text-orange-600 font-medium">{formatMinutes(s.overtimeMinutes)}</span> : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-green-700">{formatMinutes(s.approvedMinutes)}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrencyFromCents(
                        s.employee.hourlyRateCents == null
                          ? null
                          : Math.round((s.approvedMinutes * s.employee.hourlyRateCents) / 60)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-amber-600 hidden md:table-cell">{s.pendingMinutes > 0 ? formatMinutes(s.pendingMinutes) : "-"}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground hidden lg:table-cell">{s.entryCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {summaries.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">No data for this pay period.</div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

