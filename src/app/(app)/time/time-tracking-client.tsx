"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { addDays, format, differenceInSeconds, startOfDay, parseISO, startOfWeek } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn, formatMinutes, formatTime, formatDate } from "@/lib/utils";
import {
  Play,
  Square,
  Plus,
  Trash2,
  Send,
  ChevronLeft,
  ChevronRight,
  Download,
  Save,
  Receipt,
  DollarSign,
  TrendingUp,
  Calendar,
  ChevronDown,
  Pencil,
} from "lucide-react";

type TimeCategoryLike = {
  id: string;
  name: string;
  isActive: boolean;
};

type TimeEntryLike = {
  id: string;
  categoryId: string;
  source?: string;
  rejectionReason?: string | null;
  entryDate: Date | string;
  startTime?: Date | string | null;
  endTime?: Date | string | null;
  durationMinutes?: number | null;
  note?: string | null;
  status: string;
};

type ActiveTimerLike = {
  id: string;
  categoryId: string;
  startedAt: Date;
  note?: string | null;
};

type ApprovedByLite = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
} | null;
type EntryWithCategory = TimeEntryLike & { category: TimeCategoryLike; approvedBy?: ApprovedByLite };
type TimerWithCategory = ActiveTimerLike & { category: TimeCategoryLike };
type DayTimeInput = { hours: string; minutes: string };
type ExpenseStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REIMBURSED" | "REJECTED";
type PayPeriodLite = {
  id: string;
  startDate: Date | string;
  endDate: Date | string;
  status: string;
};
type ExpenseLike = {
  id: string;
  expenseDate: Date | string;
  merchant: string;
  category: string;
  description?: string | null;
  amountCents: number;
  isBillable: boolean;
  projectName?: string | null;
  receiptImageUrl?: string | null;
  status: ExpenseStatus;
  payPeriodId?: string | null;
  payPeriod?: PayPeriodLite | null;
};

const dayKey = (date: Date | string) => {
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
};

const formatCurrencyFromCents = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);

function LiveTimer({ startedAt }: { startedAt: Date }) {
  const [elapsed, setElapsed] = useState(differenceInSeconds(new Date(), startedAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(differenceInSeconds(new Date(), startedAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;

  return (
    <span className="font-mono text-2xl font-semibold tabular-nums">
      {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

export function TimeTrackingClient({
  categories,
  activeTimer: initialTimer,
  weekEntries: initialEntries,
  employeeId,
}: {
  categories: TimeCategoryLike[];
  activeTimer: TimerWithCategory | null;
  weekEntries: EntryWithCategory[];
  employeeId: string;
}) {
  const [timer, setTimer] = useState<TimerWithCategory | null>(initialTimer);
  const [entries, setEntries] = useState<EntryWithCategory[]>(initialEntries);
  const [loading, setLoading] = useState(false);
  const [isEditingWeekSubmission, setIsEditingWeekSubmission] = useState(false);
  const [expenseView, setExpenseView] = useState<"current" | "submitted">("current");
  const [selectedWeekStart, setSelectedWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  // Clock in form
  const [clockCategory, setClockCategory] = useState(categories[0]?.id ?? "");
  const [clockNote, setClockNote] = useState("");

  // Manual entry dialog
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    categoryId: categories[0]?.id ?? "",
    entryDate: format(new Date(), "yyyy-MM-dd"),
    startTime: "",
    endTime: "",
    note: "",
  });
  const [expenses, setExpenses] = useState<ExpenseLike[]>([]);
  const [expensePayPeriods, setExpensePayPeriods] = useState<PayPeriodLite[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    expenseDate: format(new Date(), "yyyy-MM-dd"),
    merchant: "",
    category: "Meals & Entertainment",
    description: "",
    amount: "",
    isBillable: false,
    projectName: "",
    receiptImageUrl: "",
    payPeriodId: "",
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(selectedWeekStart, i));
  const [weekCategoryId, setWeekCategoryId] = useState(categories[0]?.id ?? "");
  const [weekNote, setWeekNote] = useState("");
  const [weekTime, setWeekTime] = useState<Record<string, DayTimeInput>>(
    Object.fromEntries(
      weekDays.map((d) => [format(d, "yyyy-MM-dd"), { hours: "", minutes: "00" }])
    )
  );
  const activeCategories = useMemo(() => categories.filter((c) => c.isActive), [categories]);
  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) map.set(c.id, c.name);
    for (const e of entries) {
      if (!map.has(e.categoryId)) map.set(e.categoryId, e.category?.name ?? e.categoryId);
    }
    return map;
  }, [categories, entries]);
  const getCategoryLabel = (id: string) => categoryNameById.get(id) ?? "Select category";

  const refreshEntries = useCallback(async () => {
    const start = selectedWeekStart;
    const weekEnd = addDays(start, 6);

    const res = await fetch(
      `/api/time/entries?startDate=${format(start, "yyyy-MM-dd")}&endDate=${format(weekEnd, "yyyy-MM-dd")}`
    );
    if (res.ok) {
      const data = await res.json();
      setEntries(data);
    }
  }, [selectedWeekStart]);

  const refreshExpenses = useCallback(async () => {
    setExpensesLoading(true);
    try {
      const res = await fetch(`/api/expenses?view=${expenseView}`);
      if (!res.ok) return;
      const data = await res.json();
      setExpenses(data.expenses ?? []);
      setExpensePayPeriods(data.payPeriods ?? []);
    } finally {
      setExpensesLoading(false);
    }
  }, [expenseView]);

  const resetExpenseForm = () => {
    setExpenseForm({
      expenseDate: format(new Date(), "yyyy-MM-dd"),
      merchant: "",
      category: "Meals & Entertainment",
      description: "",
      amount: "",
      isBillable: false,
      projectName: "",
      receiptImageUrl: "",
      payPeriodId: "",
    });
    setEditingExpenseId(null);
  };

  const openNewExpense = () => {
    resetExpenseForm();
    setExpenseDialogOpen(true);
  };

  const openEditExpense = (expense: ExpenseLike) => {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      expenseDate: format(new Date(expense.expenseDate), "yyyy-MM-dd"),
      merchant: expense.merchant,
      category: expense.category,
      description: expense.description ?? "",
      amount: (expense.amountCents / 100).toFixed(2),
      isBillable: expense.isBillable,
      projectName: expense.projectName ?? "",
      receiptImageUrl: expense.receiptImageUrl ?? "",
      payPeriodId: expense.payPeriodId ?? "",
    });
    setExpenseDialogOpen(true);
  };

  const handleReceiptUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setExpenseForm((prev) => ({ ...prev, receiptImageUrl: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveExpense = async () => {
    const amount = Number(expenseForm.amount);
    if (!expenseForm.merchant.trim()) {
      toast.error("Merchant is required");
      return;
    }
    if (!expenseForm.expenseDate) {
      toast.error("Expense date is required");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }

    const payload = {
      expenseDate: expenseForm.expenseDate,
      merchant: expenseForm.merchant.trim(),
      category: expenseForm.category,
      description: expenseForm.description.trim() || null,
      amount,
      isBillable: expenseForm.isBillable,
      projectName: expenseForm.projectName.trim() || null,
      receiptImageUrl: expenseForm.receiptImageUrl || null,
      payPeriodId: expenseForm.payPeriodId || null,
      status: "DRAFT",
    };

    setExpensesLoading(true);
    try {
      const res = await fetch(editingExpenseId ? `/api/expenses/${editingExpenseId}` : "/api/expenses", {
        method: editingExpenseId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        toast.error("Failed to save expense");
        return;
      }
      toast.success(editingExpenseId ? "Expense updated" : "Expense created");
      setExpenseDialogOpen(false);
      resetExpenseForm();
      await refreshExpenses();
    } finally {
      setExpensesLoading(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    setExpensesLoading(true);
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete expense");
        return;
      }
      toast.success("Expense deleted");
      await refreshExpenses();
    } finally {
      setExpensesLoading(false);
    }
  };

  const handleSubmitExpenseReport = async () => {
    setExpensesLoading(true);
    try {
      const res = await fetch("/api/expenses/submit", { method: "POST" });
      if (!res.ok) {
        toast.error("Failed to submit expense report");
        return;
      }
      const data = await res.json();
      toast.success(`${data.count ?? 0} expense${data.count === 1 ? "" : "s"} submitted`);
      setExpenseView("submitted");
      await refreshExpenses();
    } finally {
      setExpensesLoading(false);
    }
  };

  useEffect(() => {
    setWeekTime(
      Object.fromEntries(
        weekDays.map((d) => [format(d, "yyyy-MM-dd"), { hours: "", minutes: "00" }])
      )
    );
    setWeekCategoryId(activeCategories[0]?.id ?? categories[0]?.id ?? "");
    setWeekNote("");
    setIsEditingWeekSubmission(false);
  }, [selectedWeekStart, activeCategories, categories]);

  useEffect(() => {
    void refreshEntries();
  }, [refreshEntries]);

  useEffect(() => {
    void refreshExpenses();
  }, [refreshExpenses]);

  const handleWeeklySubmit = async () => {
    const daysPayload = weekDays.map((day) => {
      const key = format(day, "yyyy-MM-dd");
      const dayInput = weekTime[key] ?? { hours: "", minutes: "00" };
      const hours = dayInput.hours ? Number(dayInput.hours) : 0;
      const minutesPart = Number(dayInput.minutes || "0");
      const totalMinutes = hours * 60 + minutesPart;
      return {
        entryDate: key,
        minutes: totalMinutes,
      };
    });

    if (!daysPayload.some((d) => d.minutes > 0)) {
      toast.error("Enter hours for at least one day");
      return;
    }

    if (!weekCategoryId) {
      toast.error("Select a category first");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/time/timesheet-week", {
        method: isEditingWeekSubmission ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: weekCategoryId,
          note: weekNote || undefined,
          days: daysPayload,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to submit weekly timesheet");
        return;
      }

      const data = await res.json();
      toast.success(
        `${data.count} ${data.count === 1 ? "entry" : "entries"} ${
          isEditingWeekSubmission ? "resubmitted" : "submitted"
        } for review`
      );
      setWeekTime(
        Object.fromEntries(
          weekDays.map((d) => [format(d, "yyyy-MM-dd"), { hours: "", minutes: "00" }])
        )
      );
      setWeekNote("");
      setIsEditingWeekSubmission(false);
      await refreshEntries();
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async () => {
    if (!clockCategory) return;
    setLoading(true);
    try {
      const res = await fetch("/api/time/clock-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: clockCategory, note: clockNote || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to clock in");
        return;
      }
      const data = await res.json();
      setTimer(data);
      setClockNote("");
      toast.success("Clocked in — timer started");
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/time/clock-out", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to clock out");
        return;
      }
      setTimer(null);
      toast.success("Clocked out — entry saved");
      await refreshEntries();
    } finally {
      setLoading(false);
    }
  };

  const handleManualEntry = async () => {
    if (!manualForm.startTime || !manualForm.endTime) {
      toast.error("Start and end time are required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/time/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: manualForm.categoryId,
          entryDate: manualForm.entryDate,
          startTime: `${manualForm.entryDate}T${manualForm.startTime}:00`,
          endTime: `${manualForm.entryDate}T${manualForm.endTime}:00`,
          note: manualForm.note || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to create entry");
        return;
      }
      toast.success("Time entry added");
      setManualOpen(false);
      setManualForm({
        categoryId: categories[0]?.id ?? "",
        entryDate: format(new Date(), "yyyy-MM-dd"),
        startTime: "",
        endTime: "",
        note: "",
      });
      await refreshEntries();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitEntry = async (id: string) => {
    const res = await fetch(`/api/time/entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "SUBMITTED" }),
    });
    if (res.ok) {
      toast.success("Entry submitted for approval");
      await refreshEntries();
    } else {
      toast.error("Failed to submit");
    }
  };

  const handleDeleteEntry = async (id: string) => {
    const res = await fetch(`/api/time/entries/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Entry deleted");
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } else {
      toast.error("Failed to delete");
    }
  };

  // Group entries by day
  const byDay = entries.reduce<Record<string, EntryWithCategory[]>>((acc, entry) => {
    const day = dayKey(entry.entryDate);
    if (!acc[day]) acc[day] = [];
    acc[day].push(entry);
    return acc;
  }, {});

  const totalWeekMinutes = entries
    .filter((e) => e.status !== "REJECTED")
    .reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);

  const submittedWeekEntries = entries.filter(
    (e) => e.source === "MANUAL" && (e.status === "SUBMITTED" || e.status === "APPROVED")
  );
  const weekSubmissionMinutes = submittedWeekEntries.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
  const allWeekSubmittedApproved =
    submittedWeekEntries.length > 0 && submittedWeekEntries.every((e) => e.status === "APPROVED");
  const approver = submittedWeekEntries.find((e) => e.approvedBy)?.approvedBy;
  const approvalText = allWeekSubmittedApproved
    ? `Approved by ${approver?.preferredName ?? approver?.firstName ?? "manager"}`
    : "Pending approval";

  const startEditWeeklySubmission = () => {
    if (submittedWeekEntries.length === 0) return;
    const first = submittedWeekEntries[0];
    setWeekCategoryId(first.categoryId);
    setWeekNote(first.note ?? "");

    const next = Object.fromEntries(
      weekDays.map((d) => [format(d, "yyyy-MM-dd"), { hours: "", minutes: "00" } as DayTimeInput])
    ) as Record<string, DayTimeInput>;

    for (const day of weekDays) {
      const key = format(day, "yyyy-MM-dd");
      const dayMinutes = submittedWeekEntries
        .filter((e) => dayKey(e.entryDate) === key)
        .reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
      next[key] = {
        hours: dayMinutes > 0 ? String(Math.floor(dayMinutes / 60)) : "",
        minutes: String(dayMinutes % 60).padStart(2, "0"),
      };
    }

    setWeekTime(next);
    setIsEditingWeekSubmission(true);
  };
  const weekLabel = `${format(weekDays[0], "MMM d")} - ${format(weekDays[6], "MMM d, yyyy")}`;
  const submittedMinutes = entries
    .filter((e) => e.status === "SUBMITTED")
    .reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
  const approvedMinutes = entries
    .filter((e) => e.status === "APPROVED")
    .reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
  const dayTotals = weekDays.map((day) => {
    const key = format(day, "yyyy-MM-dd");
    return entries
      .filter((e) => dayKey(e.entryDate) === key && e.status !== "REJECTED")
      .reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
  });
  const draftExpenses = expenses.filter((e) => e.status === "DRAFT");
  const totalExpenseCents = expenses.reduce((sum, e) => sum + (e.amountCents ?? 0), 0);
  const billableExpenseCents = expenses
    .filter((e) => e.isBillable)
    .reduce((sum, e) => sum + (e.amountCents ?? 0), 0);
  const submittedExpenseGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        label: string;
        range: string;
        count: number;
        totalCents: number;
        status: ExpenseStatus;
      }
    >();

    for (const expense of expenses) {
      const date = new Date(expense.expenseDate);
      const periodKey = expense.payPeriodId ?? format(date, "yyyy-MM");
      const periodLabel = expense.payPeriod
        ? `${format(new Date(expense.payPeriod.startDate), "MMMM yyyy")} Expenses`
        : `${format(date, "MMMM yyyy")} Expenses`;
      const range = expense.payPeriod
        ? `${formatDate(expense.payPeriod.startDate)} - ${formatDate(expense.payPeriod.endDate)}`
        : `${format(date, "MMM d, yyyy")}`;

      const current = groups.get(periodKey);
      if (current) {
        current.count += 1;
        current.totalCents += expense.amountCents;
      } else {
        groups.set(periodKey, {
          label: periodLabel,
          range,
          count: 1,
          totalCents: expense.amountCents,
          status: expense.status,
        });
      }
    }

    return Array.from(groups.values()).sort((a, b) => b.label.localeCompare(a.label));
  }, [expenses]);

  const handleSaveDraft = () => {
    try {
      const payload = {
        categoryId: weekCategoryId,
        note: weekNote,
        weekTime,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(`timesheet-draft:${employeeId}:${format(selectedWeekStart, "yyyy-MM-dd")}`, JSON.stringify(payload));
      toast.success("Draft saved");
    } catch {
      toast.error("Could not save draft");
    }
  };

  const handleExportWeek = () => {
    const rows = entries
      .slice()
      .sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime())
      .map((e) => [
        format(new Date(e.entryDate), "yyyy-MM-dd"),
        e.category?.name ?? "",
        String(e.durationMinutes ?? 0),
        e.status,
        (e.note ?? "").replace(/"/g, '""'),
      ]);
    const csv = [
      ["Date", "Category", "Minutes", "Status", "Note"].join(","),
      ...rows.map((r) => `${r[0]},${r[1]},${r[2]},${r[3]},"${r[4]}"`),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timesheet-${format(selectedWeekStart, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="timesheets" className="flex-col">
        <TabsList className="inline-flex w-fit rounded-full bg-muted p-1">
          <TabsTrigger value="timesheets" className="rounded-full px-4">
            Timesheets
          </TabsTrigger>
          <TabsTrigger value="previous-timesheets" className="rounded-full px-4">
            Previous Timesheets
          </TabsTrigger>
          <TabsTrigger value="time-clock" className="rounded-full px-4">
            Time Clock
          </TabsTrigger>
          <TabsTrigger value="expenses" className="rounded-full px-4">
            Expenses
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timesheets" className="space-y-6 pt-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Timesheet</h2>
              <p className="text-sm text-muted-foreground">Track your weekly hours</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setSelectedWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
                Current Week
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExportWeek}>
                <Download className="w-4 h-4" />
                Export
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleSaveDraft}>
                <Save className="w-4 h-4" />
                Save Draft
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setManualOpen(true)}>
                <Plus className="w-4 h-4" />
                Add Entry
              </Button>
              <Button size="sm" className="gap-2 bg-[#E68D83] hover:bg-[#d4786e] text-white border-0" onClick={handleWeeklySubmit} disabled={loading || !weekCategoryId}>
                <Send className="w-4 h-4" />
                {isEditingWeekSubmission ? "Resubmit" : "Submit"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-2xl font-semibold mt-0.5">{(totalWeekMinutes / 60).toFixed(1)}h</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">Submitted</p>
              <p className="text-2xl font-semibold mt-0.5 text-[#E68D83]">{(submittedMinutes / 60).toFixed(1)}h</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">Approved</p>
              <p className="text-2xl font-semibold mt-0.5 text-[#006965]">{(approvedMinutes / 60).toFixed(1)}h</p>
            </div>
          </div>

      {submittedWeekEntries.length > 0 && (
        <Card
          className={cn(
            allWeekSubmittedApproved
              ? "border-green-200 bg-green-50/60"
              : "border-amber-200 bg-amber-50/60"
          )}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Submitted Weekly Timesheet</CardTitle>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  allWeekSubmittedApproved
                    ? "bg-green-100 text-green-800 border-green-300"
                    : "bg-amber-100 text-amber-800 border-amber-300"
                )}
              >
                {approvalText}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{submittedWeekEntries[0]?.category?.name ?? "Category"}</p>
                {submittedWeekEntries[0]?.note && (
                  <p className="text-xs text-muted-foreground mt-0.5">{submittedWeekEntries[0].note}</p>
                )}
              </div>
              <p className="font-semibold">{formatMinutes(weekSubmissionMinutes)}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {weekDays.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const mins = submittedWeekEntries
                  .filter((e) => dayKey(e.entryDate) === key)
                  .reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
                return (
                  <div
                    key={key}
                    className="rounded-lg border border-black/10 bg-white px-2.5 py-2 text-xs shadow-sm"
                  >
                    <p className="font-semibold text-foreground">{format(day, "EEE")}</p>
                    <p className="text-foreground/80 mt-0.5">{mins > 0 ? formatMinutes(mins) : "-"}</p>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                className="gap-2"
                onClick={startEditWeeklySubmission}
              >
                Edit Timesheet
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base font-semibold">Weekly Timesheet (Submit for Review)</CardTitle>
            <div className="flex items-center gap-1 rounded-full border bg-muted/20 p-1">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-7 w-7"
                onClick={() => setSelectedWeekStart((prev) => addDays(prev, -7))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-xs text-muted-foreground min-w-[170px] text-center px-1">{weekLabel}</div>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-7 w-7"
                onClick={() => setSelectedWeekStart((prev) => addDays(prev, 7))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={weekCategoryId} onValueChange={(v) => setWeekCategoryId(v ?? "")}>
                <SelectTrigger>
                  <span className={cn("truncate", !weekCategoryId && "text-muted-foreground")}>
                    {weekCategoryId ? getCategoryLabel(weekCategoryId) : "Select category"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id} disabled={!c.isActive}>
                      {c.name}
                      {!c.isActive ? " (Inactive)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Note (applies to submitted days)</Label>
              <Input
                placeholder="Optional note"
                value={weekNote}
                onChange={(e) => setWeekNote(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const existingMinutes = entries
                .filter((e) => dayKey(e.entryDate) === key && e.status !== "REJECTED")
                .reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
              const value = weekTime[key] ?? { hours: "", minutes: "00" };
              return (
                <div key={key} className="rounded-lg border p-2 space-y-1.5">
                  <p className="text-xs font-medium">{format(day, "EEE")}</p>
                  <p className="text-xs text-muted-foreground">{format(day, "MMM d")}</p>
                  <div className="grid grid-cols-2 gap-1">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={24}
                      step="1"
                      placeholder="Hrs"
                      value={value.hours}
                      onChange={(e) =>
                        setWeekTime((prev) => ({
                          ...prev,
                          [key]: { ...prev[key], hours: e.target.value },
                        }))
                      }
                    />
                    <Select
                      value={value.minutes}
                      onValueChange={(v) =>
                        setWeekTime((prev) => ({
                          ...prev,
                          [key]: { ...prev[key], minutes: v ?? "00" },
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="00">00m</SelectItem>
                        <SelectItem value="15">15m</SelectItem>
                        <SelectItem value="30">30m</SelectItem>
                        <SelectItem value="45">45m</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Existing: {formatMinutes(existingMinutes)}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Enter hours and 15-minute increments per day, then submit for review.
            </p>
            <Button
              onClick={handleWeeklySubmit}
              disabled={loading || !weekCategoryId}
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              {isEditingWeekSubmission ? "Resubmit Week" : "Submit Week"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Weekly Record ── */}
      <div className="rounded-2xl overflow-hidden shadow-md border border-border/40 bg-card">
        {/* Header */}
        <div className="bg-[#14211f] px-5 pt-5 pb-4">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E68D83] mb-3">
            Weekly Record
          </p>
          <div className="flex items-center justify-between gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="w-8 h-8 text-white/50 hover:text-white hover:bg-white/10 shrink-0"
              onClick={() => setSelectedWeekStart((prev) => addDays(prev, -7))}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3 text-sm overflow-hidden">
              <span className="text-white/35 text-xs shrink-0 hidden sm:inline">
                {format(addDays(selectedWeekStart, -7), "MMM d")}
              </span>
              <span className="text-white font-semibold text-sm text-center">
                {format(weekDays[0], "MMM d")} — {format(weekDays[6], "MMM d, yyyy")}
              </span>
              <span className="text-white/35 text-xs shrink-0 hidden sm:inline">
                {format(addDays(selectedWeekStart, 7), "MMM d")}
              </span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="w-8 h-8 text-white/50 hover:text-white hover:bg-white/10 shrink-0"
              onClick={() => setSelectedWeekStart((prev) => addDays(prev, 7))}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-center text-white/35 text-[11px] mt-2">
            {totalWeekMinutes > 0 ? `${formatMinutes(totalWeekMinutes)} logged this week` : "No entries yet"}
          </p>
        </div>

        {/* Day rows */}
        <div className="divide-y divide-border/60">
          {weekDays.map((day, idx) => {
            const key = format(day, "yyyy-MM-dd");
            const dayEntries = byDay[key] ?? [];
            const isWeekend = idx >= 5;
            // Simple geometric decorations per day
            const decorations: React.ReactNode[] = [
              <svg key="d0" className="absolute inset-0 w-full h-full opacity-[0.15]" viewBox="0 0 56 56" fill="none"><circle cx="44" cy="12" r="14" stroke="white" strokeWidth="2.5" /></svg>,
              <svg key="d1" className="absolute inset-0 w-full h-full opacity-[0.15]" viewBox="0 0 56 56" fill="none"><circle cx="36" cy="10" r="3" fill="white" /><circle cx="44" cy="20" r="3" fill="white" /><circle cx="44" cy="10" r="3" fill="white" /><circle cx="40" cy="16" r="3" fill="white" /></svg>,
              <svg key="d2" className="absolute inset-0 w-full h-full opacity-[0.15]" viewBox="0 0 56 56" fill="none"><polygon points="28,4 52,48 4,48" stroke="white" strokeWidth="2.5" strokeLinejoin="round" /></svg>,
              <svg key="d3" className="absolute inset-0 w-full h-full opacity-[0.15]" viewBox="0 0 56 56" fill="none">{([14,28,42] as number[]).flatMap((x) => ([14,28,42] as number[]).map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.5" fill="white" />))}</svg>,
              <svg key="d4" className="absolute inset-0 w-full h-full opacity-[0.12]" viewBox="0 0 56 56" fill="none"><line x1="0" y1="20" x2="20" y2="0" stroke="white" strokeWidth="3" /><line x1="10" y1="46" x2="46" y2="10" stroke="white" strokeWidth="3" /><line x1="36" y1="56" x2="56" y2="36" stroke="white" strokeWidth="3" /></svg>,
              <svg key="d5" className="absolute inset-0 w-full h-full opacity-[0.15]" viewBox="0 0 56 56" fill="none"><line x1="38" y1="4" x2="52" y2="18" stroke="white" strokeWidth="2.5" strokeLinecap="round" /><line x1="52" y1="4" x2="38" y2="18" stroke="white" strokeWidth="2.5" strokeLinecap="round" /></svg>,
              <svg key="d6" className="absolute inset-0 w-full h-full opacity-[0.15]" viewBox="0 0 56 56" fill="none"><path d="M44 8 A18 18 0 1 1 44 48 A12 12 0 1 0 44 8 Z" fill="white" /></svg>,
            ];

            return (
              <div
                key={key}
                className={cn(
                  "flex items-start gap-4 px-5 py-4 transition-colors",
                  isWeekend && dayEntries.length === 0 ? "opacity-45" : "hover:bg-muted/30"
                )}
              >
                {/* Day tile */}
                <div className="relative w-[52px] h-[52px] rounded-xl overflow-hidden flex flex-col items-center justify-center shrink-0 bg-[#14211f]">
                  {decorations[idx]}
                  <span className="text-white text-[11px] font-bold uppercase tracking-wider z-10 leading-none mb-0.5">
                    {format(day, "EEE")}
                  </span>
                  <span className="text-white/40 text-[9px] z-10 leading-none">{format(day, "d")}</span>
                </div>

                {/* Entry content */}
                <div className="flex-1 min-w-0 self-center">
                  {dayEntries.length === 0 ? (
                    <span className="text-muted-foreground/30 font-semibold text-base tracking-[0.3em]">— — —</span>
                  ) : (
                    <div className="space-y-2.5">
                      {dayEntries.map((entry) => (
                        <div key={entry.id} className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            {entry.durationMinutes ? (
                              <p className="text-sm font-semibold text-foreground leading-tight">
                                {`${String(Math.floor(entry.durationMinutes / 60)).padStart(2, "0")}:${String(entry.durationMinutes % 60).padStart(2, "0")} hours`}
                              </p>
                            ) : null}
                            {entry.startTime && entry.endTime && (
                              <p className="text-xs text-muted-foreground leading-snug">
                                {format(new Date(entry.startTime), "h:mm a")} to {format(new Date(entry.endTime), "h:mm a")}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              <Badge variant="outline" className="text-[10px] h-[18px] px-1.5 border-border/60 text-muted-foreground">
                                {entry.category.name}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] h-[18px] px-1.5",
                                  entry.status === "APPROVED" && "bg-[#006965]/10 text-[#006965] border-[#006965]/30",
                                  entry.status === "SUBMITTED" && "bg-[#E68D83]/10 text-[#c4736a] border-[#E68D83]/40",
                                  entry.status === "DRAFT" && "bg-muted text-muted-foreground border-border",
                                  entry.status === "REJECTED" && "bg-red-50 text-red-600 border-red-200"
                                )}
                              >
                                {entry.status.charAt(0) + entry.status.slice(1).toLowerCase()}
                              </Badge>
                            </div>
                            {entry.rejectionReason && (
                              <p className="text-[10px] text-red-500 mt-0.5">↩ {entry.rejectionReason}</p>
                            )}
                          </div>
                          {(entry.status === "DRAFT" || entry.status === "REJECTED") && (
                            <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                              {entry.status === "DRAFT" && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="w-7 h-7 text-muted-foreground/60 hover:text-[#E68D83]"
                                  onClick={() => handleSubmitEntry(entry.id)}
                                  title="Submit for approval"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                className="w-7 h-7 text-muted-foreground/60 hover:text-destructive"
                                onClick={() => handleDeleteEntry(entry.id)}
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
        </TabsContent>

        <TabsContent value="previous-timesheets" className="pt-4">
          <div className="space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Previous Timesheets</h2>
                <p className="text-sm text-muted-foreground">Review past weekly submissions and statuses</p>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExportWeek}>
                <Download className="w-4 h-4" />
                Export History
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-5 pb-4">
                  <p className="text-sm text-muted-foreground">Submitted Weeks</p>
                  <p className="text-3xl font-semibold mt-1">12</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <p className="text-sm text-muted-foreground">Approved</p>
                  <p className="text-3xl font-semibold mt-1 text-emerald-600">10</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <p className="text-sm text-muted-foreground">Pending / Rejected</p>
                  <p className="text-3xl font-semibold mt-1">2</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-0">
                {[
                  {
                    label: "February 2026 Timesheet",
                    range: "Feb 1, 2026 - Feb 7, 2026",
                    hours: "40.0h",
                    status: "Approved",
                    statusClass: "bg-green-100 text-green-800 border-green-200",
                    submitted: "Submitted Mar 1, 2026",
                  },
                  {
                    label: "January 2026 Timesheet",
                    range: "Jan 25, 2026 - Jan 31, 2026",
                    hours: "36.5h",
                    status: "Needs Update",
                    statusClass: "bg-amber-100 text-amber-800 border-amber-200",
                    submitted: "Submitted Feb 1, 2026",
                  },
                ].map((row, index) => (
                  <div
                    key={row.label}
                    className={cn(
                      "flex items-center justify-between gap-4 p-5",
                      index !== 1 && "border-b"
                    )}
                  >
                    <div className="space-y-1">
                      <p className="text-xl font-semibold">{row.label}</p>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {row.range}
                        </span>
                        <span>{row.submitted}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-4xl font-semibold leading-none">{row.hours}</p>
                      <Badge variant="outline" className={cn("mt-2", row.statusClass)}>
                        {row.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="time-clock" className="pt-4">
          <div className="space-y-4">
            <Card className={cn(timer && "border-primary/40 bg-primary/5")}>
              <CardContent className="pt-6">
                {timer ? (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                        Currently tracking
                      </p>
                      <p className="font-semibold text-lg">{timer.category.name}</p>
                      {timer.note && (
                        <p className="text-sm text-muted-foreground mt-0.5">{timer.note}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Started at {formatTime(timer.startedAt)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <LiveTimer startedAt={new Date(timer.startedAt)} />
                      <Button
                        onClick={handleClockOut}
                        disabled={loading}
                        variant="destructive"
                        className="gap-2"
                      >
                        <Square className="w-4 h-4" />
                        Clock Out
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-base font-semibold">Clock In</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Select value={clockCategory} onValueChange={(v) => setClockCategory(v ?? "")}>
                        <SelectTrigger className="flex-1">
                          <span className={cn("truncate", !clockCategory && "text-muted-foreground")}>
                            {clockCategory ? getCategoryLabel(clockCategory) : "Select category"}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id} disabled={!c.isActive}>
                              {c.name}
                              {!c.isActive ? " (Inactive)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Note (optional)"
                        value={clockNote}
                        onChange={(e) => setClockNote(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        onClick={handleClockIn}
                        disabled={loading || !clockCategory}
                        className="gap-2 shrink-0"
                      >
                        <Play className="w-4 h-4" />
                        Clock In
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {Object.keys(byDay).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground text-sm">
                  No time entries this week. Clock in or add a manual entry to get started.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {Object.entries(byDay)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([day, dayEntries]) => {
                    const dayTotal = dayEntries.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
                    return (
                      <Card key={day}>
                        <CardHeader className="pb-2 pt-4">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium">
                              {format(parseISO(day), "EEEE, MMM d")}
                            </CardTitle>
                            <span className="text-sm text-muted-foreground font-medium">
                              {formatMinutes(dayTotal)}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-2">
                            {dayEntries.map((entry) => (
                              <div
                                key={entry.id}
                                className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-sm">{entry.category.name}</span>
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-xs",
                                        entry.status === "APPROVED" && "bg-green-50 text-green-700 border-green-200",
                                        entry.status === "SUBMITTED" && "bg-blue-50 text-blue-700 border-blue-200",
                                        entry.status === "DRAFT" && "bg-muted text-muted-foreground",
                                        entry.status === "REJECTED" && "bg-red-50 text-red-700 border-red-200"
                                      )}
                                    >
                                      {entry.status.charAt(0) + entry.status.slice(1).toLowerCase()}
                                    </Badge>
                                    {entry.source === "MANUAL" && (
                                      <Badge variant="outline" className="text-xs">Manual</Badge>
                                    )}
                                  </div>
                                  {entry.note && (
                                    <p className="text-xs text-muted-foreground mt-0.5">{entry.note}</p>
                                  )}
                                  {entry.startTime && entry.endTime && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {formatTime(entry.startTime)} - {formatTime(entry.endTime)}
                                    </p>
                                  )}
                                  {entry.rejectionReason && (
                                    <p className="text-xs text-red-600 mt-0.5">
                                      Rejected: {entry.rejectionReason}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-sm font-semibold">
                                    {formatMinutes(entry.durationMinutes ?? 0)}
                                  </p>
                                </div>
                                {(entry.status === "DRAFT" || entry.status === "REJECTED") && (
                                  <div className="flex gap-1 shrink-0">
                                    {entry.status === "DRAFT" && (
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="w-7 h-7 text-muted-foreground hover:text-blue-600"
                                        onClick={() => handleSubmitEntry(entry.id)}
                                        title="Submit for approval"
                                      >
                                        <Send className="w-3.5 h-3.5" />
                                      </Button>
                                    )}
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="w-7 h-7 text-muted-foreground hover:text-destructive"
                                      onClick={() => handleDeleteEntry(entry.id)}
                                      title="Delete entry"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="expenses" className="pt-4">
          <div className="space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Expenses</h2>
                <p className="text-sm text-muted-foreground">Track and submit your business expenses</p>
              </div>
              <Button className="gap-2" onClick={openNewExpense}>
                <Plus className="w-4 h-4" />
                New Expense
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-5 pb-4 flex items-center gap-3">
                  <div className="rounded-xl bg-blue-100 text-blue-700 p-3">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Draft Expenses</p>
                    <p className="text-3xl font-semibold leading-tight">{draftExpenses.length}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4 flex items-center gap-3">
                  <div className="rounded-xl bg-emerald-100 text-emerald-700 p-3">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Amount</p>
                    <p className="text-3xl font-semibold leading-tight">{formatCurrencyFromCents(totalExpenseCents)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4 flex items-center gap-3">
                  <div className="rounded-xl bg-violet-100 text-violet-700 p-3">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Billable</p>
                    <p className="text-3xl font-semibold leading-tight">{formatCurrencyFromCents(billableExpenseCents)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="inline-flex rounded-full bg-muted p-1">
              <button
                type="button"
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  expenseView === "current" ? "bg-background shadow-sm" : "text-muted-foreground"
                )}
                onClick={() => setExpenseView("current")}
              >
                Current Expenses
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  expenseView === "submitted" ? "bg-background shadow-sm" : "text-muted-foreground"
                )}
                onClick={() => setExpenseView("submitted")}
              >
                Submitted Reports
              </button>
            </div>

            {expenseView === "current" ? (
              <>
                <Card>
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-center gap-4">
                      <Label className="text-sm">Filter by category:</Label>
                      <Select defaultValue="all">
                        <SelectTrigger className="w-[220px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          <SelectItem value="software">Software &amp; Tools</SelectItem>
                          <SelectItem value="travel">Travel</SelectItem>
                          <SelectItem value="meals">Meals &amp; Entertainment</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-3">
                  {expensesLoading ? (
                    <Card>
                      <CardContent className="py-10 text-center text-sm text-muted-foreground">
                        Loading expenses...
                      </CardContent>
                    </Card>
                  ) : expenses.length === 0 ? (
                    <Card>
                      <CardContent className="py-10 text-center text-sm text-muted-foreground">
                        No expenses yet. Add your first expense.
                      </CardContent>
                    </Card>
                  ) : (
                    expenses.map((item) => (
                    <Card key={item.id}>
                      <CardContent className="pt-5 pb-5 flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <p className="text-2xl font-semibold leading-tight">{item.merchant}</p>
                          <p className="text-sm text-muted-foreground">{item.description ?? "No description"}</p>
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Calendar className="w-4 h-4" />
                              {formatDate(item.expenseDate)}
                            </span>
                            <Badge variant="secondary">{item.category}</Badge>
                            {item.isBillable && (
                              <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                                Billable
                              </Badge>
                            )}
                            {item.projectName && (
                              <span className="text-muted-foreground">Project: {item.projectName}</span>
                            )}
                            {item.payPeriod && (
                              <span className="text-muted-foreground">
                                Period: {formatDate(item.payPeriod.startDate)} - {formatDate(item.payPeriod.endDate)}
                              </span>
                            )}
                          </div>
                          {item.receiptImageUrl && (
                            <a
                              href={item.receiptImageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              View receipt image
                            </a>
                          )}
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="text-right">
                            <p className="text-4xl font-semibold leading-none">{formatCurrencyFromCents(item.amountCents)}</p>
                            <Badge variant="outline" className="mt-2">{item.status}</Badge>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditExpense(item)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:text-red-700"
                              onClick={() => handleDeleteExpense(item.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )))}
                </div>

                <Card className="border-blue-200 bg-blue-50/70">
                  <CardContent className="pt-5 pb-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xl font-semibold">Ready to submit?</p>
                      <p className="text-sm text-muted-foreground">
                        You have {draftExpenses.length} draft expense{draftExpenses.length === 1 ? "" : "s"} totaling {formatCurrencyFromCents(draftExpenses.reduce((sum, e) => sum + e.amountCents, 0))}
                      </p>
                    </div>
                    <Button onClick={handleSubmitExpenseReport} disabled={draftExpenses.length === 0 || expensesLoading}>
                      Submit Expense Report
                    </Button>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="space-y-3">
                {submittedExpenseGroups.length === 0 ? (
                  <Card>
                    <CardContent className="py-10 text-center text-sm text-muted-foreground">
                      No submitted expense reports yet.
                    </CardContent>
                  </Card>
                ) : (
                  submittedExpenseGroups.map((row) => (
                  <Card key={row.label}>
                    <CardContent className="pt-5 pb-5 flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-2xl font-semibold">{row.label}</p>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {row.range}
                          </span>
                          <span>{row.count} expense{row.count === 1 ? "" : "s"}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-4xl font-semibold leading-none">{formatCurrencyFromCents(row.totalCents)}</p>
                        <div className="mt-2 flex items-center justify-end gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              row.status === "REIMBURSED" && "bg-violet-100 text-violet-800 border-violet-200",
                              row.status === "APPROVED" && "bg-green-100 text-green-800 border-green-200",
                              row.status === "SUBMITTED" && "bg-blue-100 text-blue-800 border-blue-200",
                              row.status === "REJECTED" && "bg-red-100 text-red-800 border-red-200"
                            )}
                          >
                            {row.status}
                          </Badge>
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )))
                }
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingExpenseId ? "Edit Expense" : "New Expense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={expenseForm.expenseDate}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, expenseDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Amount (USD)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, amount: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Merchant</Label>
              <Input
                placeholder="Vendor name"
                value={expenseForm.merchant}
                onChange={(e) => setExpenseForm((prev) => ({ ...prev, merchant: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={expenseForm.category}
                  onValueChange={(v) => setExpenseForm((prev) => ({ ...prev, category: v ?? prev.category }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Meals & Entertainment">Meals &amp; Entertainment</SelectItem>
                    <SelectItem value="Software & Tools">Software &amp; Tools</SelectItem>
                    <SelectItem value="Travel">Travel</SelectItem>
                    <SelectItem value="Office Supplies">Office Supplies</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Pay Period</Label>
                <Select
                  value={expenseForm.payPeriodId || "__AUTO__"}
                  onValueChange={(v) =>
                    setExpenseForm((prev) => ({ ...prev, payPeriodId: v === "__AUTO__" ? "" : v ?? "" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__AUTO__">Auto by date</SelectItem>
                    {expensePayPeriods.map((period) => (
                      <SelectItem key={period.id} value={period.id}>
                        {formatDate(period.startDate)} - {formatDate(period.endDate)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={2}
                placeholder="What was this for?"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Project (optional)</Label>
              <Input
                placeholder="Project name"
                value={expenseForm.projectName}
                onChange={(e) => setExpenseForm((prev) => ({ ...prev, projectName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Receipt Image</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleReceiptUpload(file);
                }}
              />
              {expenseForm.receiptImageUrl && (
                <a
                  href={expenseForm.receiptImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  Preview uploaded receipt
                </a>
              )}
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={expenseForm.isBillable}
                onChange={(e) => setExpenseForm((prev) => ({ ...prev, isBillable: e.target.checked }))}
              />
              Billable expense
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setExpenseDialogOpen(false);
                resetExpenseForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveExpense} disabled={expensesLoading}>
              {editingExpenseId ? "Save Changes" : "Create Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual entry dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Time Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={manualForm.categoryId}
                onValueChange={(v) => setManualForm((f) => ({ ...f, categoryId: v ?? f.categoryId }))}
              >
                <SelectTrigger>
                  <span className={cn("truncate", !manualForm.categoryId && "text-muted-foreground")}>
                    {manualForm.categoryId ? getCategoryLabel(manualForm.categoryId) : "Select category"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id} disabled={!c.isActive}>
                      {c.name}
                      {!c.isActive ? " (Inactive)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={manualForm.entryDate}
                onChange={(e) => setManualForm((f) => ({ ...f, entryDate: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={manualForm.startTime}
                  onChange={(e) => setManualForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={manualForm.endTime}
                  onChange={(e) => setManualForm((f) => ({ ...f, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea
                placeholder="What did you work on?"
                value={manualForm.note}
                onChange={(e) => setManualForm((f) => ({ ...f, note: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)}>Cancel</Button>
            <Button onClick={handleManualEntry} disabled={loading}>Add Entry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

