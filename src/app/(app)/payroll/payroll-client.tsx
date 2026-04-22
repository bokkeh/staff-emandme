"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { format, startOfWeek, addDays, addWeeks } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, formatMinutes, formatDate, displayName, initials } from "@/lib/utils";
import { Download, CheckCheck, X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

type EmployeeLike = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  profilePhotoUrl?: string | null;
  hourlyRateCents?: number | null;
  jobTitle?: string | null;
  role: string;
};

type TimeEntryLike = {
  id: string;
  employeeId: string;
  payPeriodId?: string | null;
  entryDate: Date;
  startTime?: Date | null;
  endTime?: Date | null;
  durationMinutes?: number | null;
  status: string;
};

type TimeCategoryLike = {
  name: string;
};

type PayrollPeriod = {
  id: string;
  startDate: Date;
  endDate: Date;
  status: string;
  type: string;
};

type EntryWithRelations = TimeEntryLike & {
  employee: EmployeeLike;
  category: TimeCategoryLike;
};

type ExpenseWithEmployee = {
  id: string;
  employeeId: string;
  payPeriodId?: string | null;
  amountCents: number;
  status: string;
  employee: EmployeeLike;
};

type EmployeeSummary = {
  employee: EmployeeLike;
  totalMinutes: number;
  approvedMinutes: number;
  pendingMinutes: number;
  rejectedMinutes: number;
  overtimeMinutes: number;
  entryCount: number;
};

type SummaryOverride = {
  totalMinutes?: number;
  regularMinutes?: number;
  overtimeMinutes?: number;
  approvedMinutes?: number;
  pendingMinutes?: number;
  entryCount?: number;
};

function buildSummaries(employees: EmployeeLike[], entries: EntryWithRelations[]): EmployeeSummary[] {
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

function minutesToHoursDecimal(minutes: number) {
  return (minutes / 60).toFixed(2);
}

export function PayrollClient({
  payPeriods,
  currentPeriod,
  employees,
  pendingEntries: initialPending,
  periodEntries: initialPeriodEntries,
  periodExpenses: initialPeriodExpenses,
  currentRole,
  defaultCategoryId,
}: {
  payPeriods: PayrollPeriod[];
  currentPeriod: PayrollPeriod | null;
  employees: EmployeeLike[];
  pendingEntries: EntryWithRelations[];
  periodEntries: EntryWithRelations[];
  periodExpenses: ExpenseWithEmployee[];
  currentRole: string;
  defaultCategoryId: string | null;
}) {
  const [pending, setPending] = useState(initialPending);
  const [periodEntries, setPeriodEntries] = useState(initialPeriodEntries);
  const [periodExpenses] = useState(initialPeriodExpenses);
  const [loading, setLoading] = useState(false);
  const [summaryOverrides, setSummaryOverrides] = useState<Record<string, SummaryOverride>>({});
  const [selectedSummaryPeriodId, setSelectedSummaryPeriodId] = useState(currentPeriod?.id ?? payPeriods[0]?.id ?? "");
  const isAdmin = currentRole === "ADMIN";

  // Weekly entry state
  const [weekOffset, setWeekOffset] = useState(0);
  const [weeklyHours, setWeeklyHours] = useState<Record<string, Record<string, string>>>({});
  const [savingWeek, setSavingWeek] = useState(false);

  const selectedSummaryPeriod = useMemo(
    () => payPeriods.find((p) => p.id === selectedSummaryPeriodId) ?? currentPeriod ?? null,
    [payPeriods, selectedSummaryPeriodId, currentPeriod]
  );

  const summaryEntries = useMemo(
    () => periodEntries.filter((e) => e.payPeriodId === selectedSummaryPeriodId),
    [periodEntries, selectedSummaryPeriodId]
  );

  const summaries = buildSummaries(employees, summaryEntries);

  const expenseTotalsByEmployee = useMemo(() => {
    const map = new Map<string, number>();
    for (const expense of periodExpenses) {
      if (expense.payPeriodId !== selectedSummaryPeriodId) continue;
      const current = map.get(expense.employeeId) ?? 0;
      map.set(expense.employeeId, current + expense.amountCents);
    }
    return map;
  }, [periodExpenses, selectedSummaryPeriodId]);
  // Effective values per row (respects overrides), used for totals
  const effectiveRows = useMemo(() => summaries.map((s) => {
    const override = summaryOverrides[s.employee.id];
    const totalMinutes = override?.totalMinutes ?? s.totalMinutes;
    const approvedMinutes = override?.approvedMinutes ?? s.approvedMinutes;
    const pendingMinutes = override?.pendingMinutes ?? s.pendingMinutes;
    const overtimeMinutes = override?.overtimeMinutes ?? s.overtimeMinutes;
    const expenseCents = expenseTotalsByEmployee.get(s.employee.id) ?? 0;
    const payoutCents = s.employee.hourlyRateCents != null
      ? Math.round((approvedMinutes * s.employee.hourlyRateCents) / 60)
      : 0;
    const pendingPayoutCents = s.employee.hourlyRateCents != null
      ? Math.round(((approvedMinutes + pendingMinutes) * s.employee.hourlyRateCents) / 60)
      : 0;
    return { id: s.employee.id, totalMinutes, approvedMinutes, pendingMinutes, overtimeMinutes, expenseCents, payoutCents, pendingPayoutCents, hasRate: s.employee.hourlyRateCents != null };
  }), [summaries, summaryOverrides, expenseTotalsByEmployee]);

  const totals = useMemo(() => ({
    totalMinutes: effectiveRows.reduce((s, r) => s + r.totalMinutes, 0),
    approvedMinutes: effectiveRows.reduce((s, r) => s + r.approvedMinutes, 0),
    overtimeMinutes: effectiveRows.reduce((s, r) => s + r.overtimeMinutes, 0),
    pendingMinutes: effectiveRows.reduce((s, r) => s + r.pendingMinutes, 0),
    payoutCents: effectiveRows.reduce((s, r) => s + r.payoutCents, 0),
    pendingPayoutCents: effectiveRows.reduce((s, r) => s + r.pendingPayoutCents, 0),
    expenseCents: effectiveRows.reduce((s, r) => s + r.expenseCents, 0),
    entryCount: summaries.reduce((s, sm) => s + (summaryOverrides[sm.employee.id]?.entryCount ?? sm.entryCount), 0),
  }), [effectiveRows, summaries, summaryOverrides]);

  // Weekly entry computed values
  const weekDates = useMemo(() => {
    const base = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(base, i));
  }, [weekOffset]);

  const dayKey = (date: Date) => format(date, "yyyy-MM-dd");

  const empWeekTotals = useMemo(() => {
    return employees.map((emp) => {
      const totalHours = weekDates.reduce((s, date) => {
        const val = parseFloat(weeklyHours[emp.id]?.[dayKey(date)] || "0");
        return s + (isNaN(val) ? 0 : Math.max(0, val));
      }, 0);
      const payoutCents = emp.hourlyRateCents != null
        ? Math.round(totalHours * emp.hourlyRateCents)
        : null;
      return { empId: emp.id, totalHours, payoutCents };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, weeklyHours, weekDates]);

  const weekGrandTotals = useMemo(() => ({
    totalHours: empWeekTotals.reduce((s, r) => s + r.totalHours, 0),
    payoutCents: empWeekTotals.reduce((s, r) => s + (r.payoutCents ?? 0), 0),
  }), [empWeekTotals]);

  const biweeklySummary = useMemo(() => {
    const entries = periodEntries.filter((e) => e.payPeriodId === currentPeriod?.id);
    let approvedCents = 0;
    let totalCents = 0;
    for (const emp of employees) {
      const rate = emp.hourlyRateCents;
      if (!rate) continue;
      const empEntries = entries.filter((e) => e.employeeId === emp.id);
      const approvedMins = empEntries.filter((e) => e.status === "APPROVED").reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
      const pendingMins = empEntries.filter((e) => e.status === "SUBMITTED").reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
      approvedCents += Math.round((approvedMins * rate) / 60);
      totalCents += Math.round(((approvedMins + pendingMins) * rate) / 60);
    }
    return { approvedCents, totalCents };
  }, [periodEntries, currentPeriod, employees]);

  const weeksLog = useMemo(() => {
    const groups = new Map<string, {
      weekStart: Date;
      weekEnd: Date;
      byEmployee: Map<string, { employee: EmployeeLike; totalMinutes: number }>;
    }>();
    for (const entry of periodEntries) {
      const date = new Date(entry.entryDate);
      const wStart = startOfWeek(date, { weekStartsOn: 1 });
      const key = format(wStart, "yyyy-MM-dd");
      if (!groups.has(key)) {
        groups.set(key, { weekStart: wStart, weekEnd: addDays(wStart, 6), byEmployee: new Map() });
      }
      const group = groups.get(key)!;
      const existing = group.byEmployee.get(entry.employeeId);
      if (!existing) {
        group.byEmployee.set(entry.employeeId, { employee: entry.employee, totalMinutes: entry.durationMinutes ?? 0 });
      } else {
        existing.totalMinutes += entry.durationMinutes ?? 0;
      }
    }
    return Array.from(groups.values()).sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
  }, [periodEntries]);

  const pendingGroups = useMemo(() => {
    const groups = new Map<string, { employee: EmployeeLike; entries: EntryWithRelations[]; totalMinutes: number }>();
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
      setPeriodEntries((prev) =>
        prev.map((e) =>
          idSet.has(e.id)
            ? {
                ...e,
                status: action,
              }
            : e
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!currentPeriod) return;
    window.open(`/api/payroll/export?payPeriodId=${currentPeriod.id}`, "_blank");
  };

  const updateSummaryOverride = (
    employeeId: string,
    field: keyof SummaryOverride,
    value: string,
    options?: { isCount?: boolean }
  ) => {
    const parsed = Number(value);
    const nextValue =
      value.trim() === "" || Number.isNaN(parsed)
        ? undefined
        : options?.isCount
          ? Math.max(0, Math.round(parsed))
          : Math.max(0, Math.round(parsed * 60));

    setSummaryOverrides((prev) => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        [field]: nextValue,
      },
    }));
  };

  const resetSummaryOverride = (employeeId: string) => {
    setSummaryOverrides((prev) => {
      const next = { ...prev };
      delete next[employeeId];
      return next;
    });
  };

  const handleSaveWeek = async () => {
    if (!defaultCategoryId) {
      toast.error("No time category found. Please create a time category first.");
      return;
    }
    const hasAnyHours = employees.some((emp) =>
      weekDates.some((date) => {
        const val = parseFloat(weeklyHours[emp.id]?.[dayKey(date)] || "0");
        return !isNaN(val) && val > 0;
      })
    );
    if (!hasAnyHours) {
      toast.error("Enter hours for at least one employee.");
      return;
    }
    setSavingWeek(true);
    const errors: string[] = [];
    const newEntries: EntryWithRelations[] = [];
    for (const emp of employees) {
      const days = weekDates.map((date) => {
        const raw = parseFloat(weeklyHours[emp.id]?.[dayKey(date)] || "0");
        const hours = isNaN(raw) ? 0 : Math.max(0, raw);
        return { entryDate: dayKey(date), minutes: Math.round((hours * 60) / 15) * 15 };
      });
      if (days.every((d) => d.minutes === 0)) continue;
      try {
        const res = await fetch("/api/time/timesheet-week", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId: emp.id, categoryId: defaultCategoryId, days }),
        });
        if (res.ok) {
          const data = await res.json();
          for (const entry of data.entries) {
            newEntries.push({
              ...entry,
              employee: emp,
              entryDate: new Date(entry.entryDate),
              startTime: entry.startTime ? new Date(entry.startTime) : null,
              endTime: entry.endTime ? new Date(entry.endTime) : null,
            });
          }
        } else {
          const data = await res.json().catch(() => ({ error: "Unknown error" }));
          errors.push(`${displayName(emp)}: ${data.error}`);
        }
      } catch {
        errors.push(`${displayName(emp)}: Network error`);
      }
    }
    if (newEntries.length > 0) {
      setPeriodEntries((prev) => {
        const updatedIds = new Set(newEntries.map((e) => e.id));
        return [...prev.filter((e) => !updatedIds.has(e.id)), ...newEntries];
      });
      setWeeklyHours({});
      const empCount = new Set(newEntries.map((e) => e.employeeId)).size;
      toast.success(`Saved ${empCount} employee${empCount !== 1 ? "s" : ""} for the week`);
    }
    errors.forEach((e) => toast.error(e));
    setSavingWeek(false);
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
          <TabsTrigger value="weekly-entry" className="rounded-full px-4">Weekly Entry</TabsTrigger>
          <TabsTrigger value="summary" className="rounded-full px-4">Period Summary</TabsTrigger>
          <TabsTrigger value="history" className="rounded-full px-4">History</TabsTrigger>
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
                          <Link href={`/team/${group.employee.id}`} className="font-medium text-sm hover:text-primary transition-colors">
                            {displayName(group.employee)}
                          </Link>
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

      <TabsContent value="weekly-entry">
        {/* Bi-weekly payout summary */}
        {currentPeriod && (
          <Card className="mb-4 border-primary/20 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
                    Bi-Weekly Pay Period
                  </p>
                  <p className="text-sm font-medium">
                    {formatDate(currentPeriod.startDate)} — {formatDate(currentPeriod.endDate)}
                  </p>
                </div>
                <div className="flex gap-6">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Approved Payout</p>
                    <p className="text-2xl font-bold text-green-700">
                      {formatCurrencyFromCents(biweeklySummary.approvedCents)}
                    </p>
                  </div>
                  {biweeklySummary.totalCents > biweeklySummary.approvedCents && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total if All Approved</p>
                      <p className="text-2xl font-bold text-amber-600">
                        {formatCurrencyFromCents(biweeklySummary.totalCents)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Weekly hours entry table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-sm font-medium">Enter Weekly Hours</CardTitle>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setWeekOffset((prev) => prev - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[190px] text-center">
                  {format(weekDates[0], "MMM d")} – {format(weekDates[6], "MMM d, yyyy")}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setWeekOffset((prev) => prev + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                {weekOffset !== 0 && (
                  <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setWeekOffset(0)}>
                    Today
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Employee</th>
                  {weekDates.map((date) => (
                    <th key={dayKey(date)} className="text-center px-1 py-2 text-xs font-medium text-muted-foreground">
                      <div>{format(date, "EEE")}</div>
                      <div className="font-normal opacity-70">{format(date, "M/d")}</div>
                    </th>
                  ))}
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Total Hrs</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Rate</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Est. Pay</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, i) => {
                  const row = empWeekTotals.find((r) => r.empId === emp.id)!;
                  return (
                    <tr key={emp.id} className={cn("hover:bg-muted/10", i !== employees.length - 1 && "border-b")}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6 shrink-0">
                            <AvatarImage src={emp.profilePhotoUrl ?? undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {initials(displayName(emp))}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm whitespace-nowrap">{displayName(emp)}</span>
                        </div>
                      </td>
                      {weekDates.map((date) => (
                        <td key={dayKey(date)} className="px-1 py-2">
                          <Input
                            type="number"
                            min={0}
                            max={24}
                            step={0.5}
                            value={weeklyHours[emp.id]?.[dayKey(date)] ?? ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setWeeklyHours((prev) => ({
                                ...prev,
                                [emp.id]: { ...(prev[emp.id] ?? {}), [dayKey(date)]: val },
                              }));
                            }}
                            placeholder="—"
                            className="h-8 w-16 text-center text-sm px-1"
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {row.totalHours > 0 ? (
                          row.totalHours.toFixed(2)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground whitespace-nowrap">
                        {emp.hourlyRateCents != null ? `${formatCurrencyFromCents(emp.hourlyRateCents)}/hr` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {row.payoutCents != null && row.totalHours > 0 ? (
                          <span className="text-green-700">{formatCurrencyFromCents(row.payoutCents)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/40 font-semibold">
                  <td className="px-3 py-2 text-sm" colSpan={8}>Total</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums">
                    {weekGrandTotals.totalHours > 0 ? weekGrandTotals.totalHours.toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right text-sm text-green-700">
                    {weekGrandTotals.payoutCents > 0 ? formatCurrencyFromCents(weekGrandTotals.payoutCents) : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
            <div className="mt-4 flex justify-end">
              <Button
                onClick={handleSaveWeek}
                disabled={savingWeek || weekGrandTotals.totalHours === 0}
              >
                {savingWeek && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Week
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Saved weeks log */}
        {weeksLog.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Weekly Log</h3>
            {weeksLog.map((week) => {
              const empRows = Array.from(week.byEmployee.values());
              const weekTotalMins = empRows.reduce((s, d) => s + d.totalMinutes, 0);
              const weekPayoutCents = empRows.reduce((s, d) => {
                const rate = d.employee.hourlyRateCents;
                return s + (rate ? Math.round((d.totalMinutes * rate) / 60) : 0);
              }, 0);
              return (
                <Card key={format(week.weekStart, "yyyy-MM-dd")}>
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        {format(week.weekStart, "MMM d")} — {format(week.weekEnd, "MMM d, yyyy")}
                      </CardTitle>
                      <span className="text-sm font-bold text-green-700">
                        {formatCurrencyFromCents(weekPayoutCents)}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 pb-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left px-2 py-1.5 text-xs font-medium text-muted-foreground">Employee</th>
                          <th className="text-right px-2 py-1.5 text-xs font-medium text-muted-foreground">Hours</th>
                          <th className="text-right px-2 py-1.5 text-xs font-medium text-muted-foreground">Payout</th>
                        </tr>
                      </thead>
                      <tbody>
                        {empRows.map((d, idx) => (
                          <tr key={d.employee.id} className={cn(idx !== empRows.length - 1 && "border-b")}>
                            <td className="px-2 py-1.5 font-medium">{displayName(d.employee)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">
                              {(d.totalMinutes / 60).toFixed(2)}h
                            </td>
                            <td className="px-2 py-1.5 text-right text-green-700">
                              {d.employee.hourlyRateCents
                                ? formatCurrencyFromCents(Math.round((d.totalMinutes * d.employee.hourlyRateCents) / 60))
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t font-semibold">
                          <td className="px-2 py-1.5">Total</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{(weekTotalMins / 60).toFixed(2)}h</td>
                          <td className="px-2 py-1.5 text-right text-green-700">{formatCurrencyFromCents(weekPayoutCents)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </TabsContent>

      <TabsContent value="summary">
        <Card>
          <CardContent className="pt-0">
            <div className="py-4 flex items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">Viewing pay period</div>
              <Select value={selectedSummaryPeriodId} onValueChange={(v) => setSelectedSummaryPeriodId(v ?? "")}>
                <SelectTrigger className="w-[280px]">
                  <span className="truncate">
                    {selectedSummaryPeriod
                      ? `${formatDate(selectedSummaryPeriod.startDate)} - ${formatDate(selectedSummaryPeriod.endDate)}${selectedSummaryPeriod.status === "OPEN" ? " (Current)" : ""}`
                      : "Select pay period"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {payPeriods.map((period) => (
                    <SelectItem key={period.id} value={period.id}>
                      {formatDate(period.startDate)} - {formatDate(period.endDate)}
                      {period.status === "OPEN" ? " (Current)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Employee</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Total</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Regular</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">OT</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Approved</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Est. Payout <span className="font-normal">(approved)</span></th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Expenses</th>
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
                          <Link href={`/team/${s.employee.id}`} className="font-medium hover:text-primary transition-colors">
                            {displayName(s.employee)}
                          </Link>
                          <p className="text-xs text-muted-foreground">{s.employee.jobTitle ?? s.employee.role}</p>
                        </div>
                      </div>
                    </td>
                    {(() => {
                      const override = summaryOverrides[s.employee.id];
                      const expenseCents = expenseTotalsByEmployee.get(s.employee.id) ?? 0;
                      const totalMinutes = override?.totalMinutes ?? s.totalMinutes;
                      const regularMinutes = override?.regularMinutes ?? Math.min(totalMinutes, 40 * 60);
                      const overtimeMinutes = override?.overtimeMinutes ?? s.overtimeMinutes;
                      const approvedMinutes = override?.approvedMinutes ?? s.approvedMinutes;
                      const pendingMinutes = override?.pendingMinutes ?? s.pendingMinutes;
                      const entryCount = override?.entryCount ?? s.entryCount;
                      return (
                        <>
                    <td className="px-4 py-3 text-right font-medium">
                      {isAdmin ? (
                        <Input
                          type="number"
                          min={0}
                          step="0.25"
                          value={minutesToHoursDecimal(totalMinutes)}
                          onChange={(e) => updateSummaryOverride(s.employee.id, "totalMinutes", e.target.value)}
                          className="h-8 w-24 ml-auto text-right"
                        />
                      ) : (
                        formatMinutes(totalMinutes)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">
                      {isAdmin ? (
                        <Input
                          type="number"
                          min={0}
                          step="0.25"
                          value={minutesToHoursDecimal(regularMinutes)}
                          onChange={(e) => updateSummaryOverride(s.employee.id, "regularMinutes", e.target.value)}
                          className="h-8 w-24 ml-auto text-right"
                        />
                      ) : (
                        formatMinutes(regularMinutes)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      {isAdmin ? (
                        <Input
                          type="number"
                          min={0}
                          step="0.25"
                          value={minutesToHoursDecimal(overtimeMinutes)}
                          onChange={(e) => updateSummaryOverride(s.employee.id, "overtimeMinutes", e.target.value)}
                          className="h-8 w-24 ml-auto text-right"
                        />
                      ) : overtimeMinutes > 0 ? (
                        <span className="text-orange-600 font-medium">{formatMinutes(overtimeMinutes)}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-green-700">
                      {isAdmin ? (
                        <Input
                          type="number"
                          min={0}
                          step="0.25"
                          value={minutesToHoursDecimal(approvedMinutes)}
                          onChange={(e) => updateSummaryOverride(s.employee.id, "approvedMinutes", e.target.value)}
                          className="h-8 w-24 ml-auto text-right"
                        />
                      ) : (
                        formatMinutes(approvedMinutes)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.employee.hourlyRateCents == null ? (
                        <span className="text-muted-foreground">-</span>
                      ) : (
                        <div>
                          <p className="font-medium text-green-700">
                            {formatCurrencyFromCents(Math.round((approvedMinutes * s.employee.hourlyRateCents) / 60))}
                          </p>
                          {pendingMinutes > 0 && (
                            <p className="text-xs text-amber-600 mt-0.5">
                              {formatCurrencyFromCents(Math.round(((approvedMinutes + pendingMinutes) * s.employee.hourlyRateCents) / 60))} if approved
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-blue-700">
                      {expenseCents > 0 ? formatCurrencyFromCents(expenseCents) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-amber-600 hidden md:table-cell">
                      {isAdmin ? (
                        <Input
                          type="number"
                          min={0}
                          step="0.25"
                          value={minutesToHoursDecimal(pendingMinutes)}
                          onChange={(e) => updateSummaryOverride(s.employee.id, "pendingMinutes", e.target.value)}
                          className="h-8 w-24 ml-auto text-right"
                        />
                      ) : pendingMinutes > 0 ? (
                        formatMinutes(pendingMinutes)
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground hidden lg:table-cell">
                      {isAdmin ? (
                        <div className="flex justify-end gap-2 items-center">
                          <Input
                            type="number"
                            min={0}
                            step="1"
                            value={String(entryCount)}
                            onChange={(e) => updateSummaryOverride(s.employee.id, "entryCount", e.target.value, { isCount: true })}
                            className="h-8 w-20 text-right"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => resetSummaryOverride(s.employee.id)}
                          >
                            Reset
                          </Button>
                        </div>
                      ) : (
                        entryCount
                      )}
                    </td>
                        </>
                      );
                    })()}
                  </tr>
                ))}
              </tbody>
              {summaries.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 bg-muted/40 font-semibold">
                    <td className="px-4 py-3 text-sm">Totals</td>
                    <td className="px-4 py-3 text-right text-sm">{formatMinutes(totals.totalMinutes)}</td>
                    <td className="px-4 py-3 text-right text-sm text-muted-foreground hidden sm:table-cell">
                      {formatMinutes(Math.min(totals.totalMinutes, totals.totalMinutes - totals.overtimeMinutes))}
                    </td>
                    <td className="px-4 py-3 text-right text-sm hidden sm:table-cell">
                      {totals.overtimeMinutes > 0
                        ? <span className="text-orange-600">{formatMinutes(totals.overtimeMinutes)}</span>
                        : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-green-700">{formatMinutes(totals.approvedMinutes)}</td>
                    <td className="px-4 py-3 text-right text-sm">
                      <p className="text-green-700">{formatCurrencyFromCents(totals.payoutCents)}</p>
                      {totals.pendingMinutes > 0 && (
                        <p className="text-xs text-amber-600 font-normal mt-0.5">
                          {formatCurrencyFromCents(totals.pendingPayoutCents)} if approved
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-blue-700">
                      {totals.expenseCents > 0 ? formatCurrencyFromCents(totals.expenseCents) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-amber-600 hidden md:table-cell">
                      {totals.pendingMinutes > 0 ? formatMinutes(totals.pendingMinutes) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-muted-foreground hidden lg:table-cell">
                      {totals.entryCount}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
            {summaries.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No data for {selectedSummaryPeriod ? `${formatDate(selectedSummaryPeriod.startDate)} - ${formatDate(selectedSummaryPeriod.endDate)}` : "this pay period"}.
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* History Tab */}
      <TabsContent value="history">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pay Period History</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {payPeriods.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No pay periods found.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Period</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Total Hours</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Approved</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Pending</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Employees</th>
                    {isAdmin && <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Export</th>}
                  </tr>
                </thead>
                <tbody>
                  {payPeriods.map((period, i) => {
                    const entries = periodEntries.filter((e) => e.payPeriodId === period.id);
                    const totalMinutes = entries.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
                    const approvedMinutes = entries.filter((e) => e.status === "APPROVED").reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
                    const pendingMinutes = entries.filter((e) => e.status === "SUBMITTED").reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
                    const employeeCount = new Set(entries.map((e) => e.employeeId)).size;
                    return (
                      <tr key={period.id} className={cn("hover:bg-muted/20", i !== payPeriods.length - 1 && "border-b")}>
                        <td className="px-4 py-3 font-medium">
                          {formatDate(period.startDate)} — {formatDate(period.endDate)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              period.status === "OPEN" && "bg-green-50 text-green-700 border-green-200",
                              period.status === "PROCESSING" && "bg-amber-50 text-amber-700 border-amber-200",
                              period.status === "CLOSED" && "bg-muted text-muted-foreground"
                            )}
                          >
                            {period.status.charAt(0) + period.status.slice(1).toLowerCase()}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">{formatMinutes(totalMinutes)}</td>
                        <td className="px-4 py-3 text-right text-green-700 font-medium">{formatMinutes(approvedMinutes)}</td>
                        <td className="px-4 py-3 text-right text-amber-600 hidden md:table-cell">{formatMinutes(pendingMinutes)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground hidden lg:table-cell">{employeeCount}</td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => window.open(`/api/payroll/export?payPeriodId=${period.id}`, "_blank")}
                            >
                              <Download className="w-3 h-3" />
                              CSV
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

