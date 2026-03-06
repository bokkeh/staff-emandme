"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { format, differenceInSeconds, startOfDay, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Play, Square, Plus, Trash2, Send, Clock, Edit2 } from "lucide-react";
import type { TimeCategory, TimeEntry, ActiveTimer } from "@prisma/client";
import { useRouter } from "next/navigation";

type EntryWithCategory = TimeEntry & { category: TimeCategory };
type TimerWithCategory = ActiveTimer & { category: TimeCategory };

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
  categories: TimeCategory[];
  activeTimer: TimerWithCategory | null;
  weekEntries: EntryWithCategory[];
  employeeId: string;
}) {
  const router = useRouter();
  const [timer, setTimer] = useState<TimerWithCategory | null>(initialTimer);
  const [entries, setEntries] = useState<EntryWithCategory[]>(initialEntries);
  const [loading, setLoading] = useState(false);

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

  const refreshEntries = useCallback(async () => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const res = await fetch(
      `/api/time/entries?startDate=${format(weekStart, "yyyy-MM-dd")}&endDate=${format(weekEnd, "yyyy-MM-dd")}`
    );
    if (res.ok) {
      const data = await res.json();
      setEntries(data);
    }
  }, []);

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
    const day = format(new Date(entry.entryDate), "yyyy-MM-dd");
    if (!acc[day]) acc[day] = [];
    acc[day].push(entry);
    return acc;
  }, {});

  const totalWeekMinutes = entries
    .filter((e) => e.status !== "REJECTED")
    .reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);

  const pendingCount = entries.filter((e) => e.status === "DRAFT").length;

  return (
    <div className="space-y-6">
      {/* Active timer / clock in card */}
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
              <p className="text-sm font-medium">Clock In</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={clockCategory} onValueChange={(v) => setClockCategory(v ?? "")}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: "This Week",
            value: formatMinutes(totalWeekMinutes),
            sub: `${(totalWeekMinutes / 60).toFixed(1)}h total`,
          },
          {
            label: "Today",
            value: formatMinutes(
              entries
                .filter((e) => {
                  const d = new Date(e.entryDate);
                  const today = new Date();
                  return (
                    d.getFullYear() === today.getFullYear() &&
                    d.getMonth() === today.getMonth() &&
                    d.getDate() === today.getDate()
                  );
                })
                .reduce((s, e) => s + (e.durationMinutes ?? 0), 0)
            ),
            sub: "logged today",
          },
          {
            label: "Pending",
            value: String(pendingCount),
            sub: pendingCount === 1 ? "draft entry" : "draft entries",
          },
          {
            label: "Approved",
            value: formatMinutes(
              entries
                .filter((e) => e.status === "APPROVED")
                .reduce((s, e) => s + (e.durationMinutes ?? 0), 0)
            ),
            sub: "this week",
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-5 pb-4">
              <p className="text-2xl font-semibold">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              <p className="text-xs text-muted-foreground/60">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Weekly entries */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">This Week</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setManualOpen(true)}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Entry
        </Button>
      </div>

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
                                {formatTime(entry.startTime)} – {formatTime(entry.endTime)}
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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
