"use client";

import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
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

function buildSummaries(
  employees: Employee[],
  entries: EntryWithRelations[]
): EmployeeSummary[] {
  return employees.map((emp) => {
    const empEntries = entries.filter((e) => e.employeeId === emp.id);
    const total = empEntries.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
    const approved = empEntries
      .filter((e) => e.status === "APPROVED")
      .reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
    const pending = empEntries
      .filter((e) => e.status === "SUBMITTED")
      .reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
    const rejected = empEntries
      .filter((e) => e.status === "REJECTED")
      .reduce((s, e) => s + (e.durationMinutes ?? 0), 0);

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const summaries = buildSummaries(employees, periodEntries);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === pending.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pending.map((e) => e.id)));
    }
  };

  const handleBulkAction = async (action: "APPROVED" | "REJECTED") => {
    if (selected.size === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/payroll/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryIds: Array.from(selected), action }),
      });
      if (!res.ok) {
        toast.error("Action failed");
        return;
      }
      const { count } = await res.json();
      toast.success(
        `${count} ${count === 1 ? "entry" : "entries"} ${action === "APPROVED" ? "approved" : "rejected"}`
      );
      setPending((prev) => prev.filter((e) => !selected.has(e.id)));
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  };

  const handleSingleAction = async (id: string, action: "APPROVED" | "REJECTED") => {
    const res = await fetch(`/api/time/entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: action }),
    });
    if (res.ok) {
      toast.success(action === "APPROVED" ? "Approved" : "Rejected");
      setPending((prev) => prev.filter((e) => e.id !== id));
    } else {
      toast.error("Failed");
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
          <TabsTrigger value="summary" className="rounded-full px-4">
            Period Summary
          </TabsTrigger>
        </TabsList>

        {currentRole === "ADMIN" && currentPeriod && (
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Current period info */}
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
            Pay period: {formatDate(currentPeriod.startDate)} — {formatDate(currentPeriod.endDate)}
          </span>
        </div>
      )}

      {/* Pending Approvals Tab */}
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  {pending.length} {pending.length === 1 ? "entry" : "entries"} awaiting review
                </CardTitle>
                {selected.size > 0 && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-green-700 border-green-200 hover:bg-green-50"
                      onClick={() => handleBulkAction("APPROVED")}
                      disabled={loading}
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Approve {selected.size}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => handleBulkAction("REJECTED")}
                      disabled={loading}
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject {selected.size}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="flex items-center gap-3 px-3 py-1.5 text-xs text-muted-foreground border-b">
                  <Checkbox
                    checked={selected.size === pending.length && pending.length > 0}
                    onCheckedChange={toggleAll}
                  />
                  <span>Select all</span>
                </div>
                {pending.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg transition-colors",
                      selected.has(entry.id) ? "bg-primary/5 border border-primary/20" : "bg-muted/30 hover:bg-muted/50"
                    )}
                  >
                    <Checkbox
                      checked={selected.has(entry.id)}
                      onCheckedChange={() => toggleSelect(entry.id)}
                    />
                    <Avatar className="w-8 h-8 shrink-0">
                      <AvatarImage src={entry.employee.profilePhotoUrl ?? undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {initials(displayName(entry.employee))}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{displayName(entry.employee)}</span>
                        <span className="text-muted-foreground text-sm">·</span>
                        <span className="text-sm">{entry.category.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(entry.entryDate)}
                        {entry.startTime && entry.endTime
                          ? ` · ${format(new Date(entry.startTime), "h:mm a")} – ${format(new Date(entry.endTime), "h:mm a")}`
                          : ""}
                      </p>
                      {entry.note && (
                        <p className="text-xs text-muted-foreground mt-0.5">{entry.note}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-sm">{formatMinutes(entry.durationMinutes ?? 0)}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-7 h-7 text-green-700 hover:bg-green-50"
                        onClick={() => handleSingleAction(entry.id, "APPROVED")}
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-7 h-7 text-red-600 hover:bg-red-50"
                        onClick={() => handleSingleAction(entry.id, "REJECTED")}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* Period Summary Tab */}
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
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Pending</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Entries</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s, i) => (
                  <tr
                    key={s.employee.id}
                    className={cn("hover:bg-muted/20", i !== summaries.length - 1 && "border-b")}
                  >
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
                    <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">
                      {formatMinutes(Math.min(s.totalMinutes, 40 * 60))}
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      {s.overtimeMinutes > 0 ? (
                        <span className="text-orange-600 font-medium">{formatMinutes(s.overtimeMinutes)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-green-700">{formatMinutes(s.approvedMinutes)}</td>
                    <td className="px-4 py-3 text-right text-amber-600 hidden md:table-cell">
                      {s.pendingMinutes > 0 ? formatMinutes(s.pendingMinutes) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground hidden lg:table-cell">{s.entryCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {summaries.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No data for this pay period.
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
