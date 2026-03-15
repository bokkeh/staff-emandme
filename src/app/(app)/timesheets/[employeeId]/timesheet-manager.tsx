"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { addDays, format, startOfWeek } from "date-fns";
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
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

type Category = { id: string; name: string; isActive: boolean };

type TimeEntry = {
  id: string;
  categoryId: string;
  category: Category;
  entryDate: string | Date;
  startTime?: string | Date | null;
  endTime?: string | Date | null;
  durationMinutes?: number | null;
  note?: string | null;
  status: string;
  source?: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  APPROVED: "bg-green-50 text-green-700 border-green-200",
  SUBMITTED: "bg-blue-50 text-blue-700 border-blue-200",
  DRAFT: "bg-muted text-muted-foreground",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
};

const dayKey = (date: string | Date) => new Date(date).toISOString().slice(0, 10);

export function TimesheetManager({
  targetEmployeeId,
  categories,
  userRole,
}: {
  targetEmployeeId: string;
  categories: Category[];
  userRole: string;
}) {
  const isAdminOrManager = userRole === "ADMIN" || userRole === "MANAGER";
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const activeCategories = categories.filter((c) => c.isActive);

  const [form, setForm] = useState({
    categoryId: activeCategories[0]?.id ?? categories[0]?.id ?? "",
    entryDate: format(new Date(), "yyyy-MM-dd"),
    startTime: "",
    endTime: "",
    note: "",
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekLabel = `${format(weekDays[0], "MMM d")} – ${format(weekDays[6], "MMM d, yyyy")}`;

  const refresh = useCallback(async () => {
    const start = format(weekStart, "yyyy-MM-dd");
    const end = format(addDays(weekStart, 6), "yyyy-MM-dd");
    const res = await fetch(
      `/api/time/entries?employeeId=${targetEmployeeId}&startDate=${start}&endDate=${end}`
    );
    if (res.ok) setEntries(await res.json());
  }, [weekStart, targetEmployeeId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const openAdd = () => {
    setEditingEntry(null);
    setForm({
      categoryId: activeCategories[0]?.id ?? categories[0]?.id ?? "",
      entryDate: format(new Date(), "yyyy-MM-dd"),
      startTime: "",
      endTime: "",
      note: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setForm({
      categoryId: entry.categoryId,
      entryDate: dayKey(entry.entryDate),
      startTime: entry.startTime ? format(new Date(entry.startTime), "HH:mm") : "",
      endTime: entry.endTime ? format(new Date(entry.endTime), "HH:mm") : "",
      note: entry.note ?? "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.startTime || !form.endTime) {
      toast.error("Start and end time are required");
      return;
    }
    setLoading(true);
    try {
      if (editingEntry) {
        const res = await fetch(`/api/time/entries/${editingEntry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: form.categoryId,
            entryDate: form.entryDate,
            startTime: `${form.entryDate}T${form.startTime}:00`,
            endTime: `${form.entryDate}T${form.endTime}:00`,
            note: form.note || undefined,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error ?? "Failed to save");
          return;
        }
        toast.success("Entry updated");
      } else {
        const res = await fetch("/api/time/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId: targetEmployeeId,
            categoryId: form.categoryId,
            entryDate: form.entryDate,
            startTime: `${form.entryDate}T${form.startTime}:00`,
            endTime: `${form.entryDate}T${form.endTime}:00`,
            note: form.note || undefined,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error ?? "Failed to create entry");
          return;
        }
        toast.success("Entry added");
      }
      setDialogOpen(false);
      await refresh();
    } finally {
      setLoading(false);
    }
  };

  const deleteEntry = async (id: string) => {
    const res = await fetch(`/api/time/entries/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Entry deleted");
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } else {
      toast.error("Failed to delete");
    }
  };

  const totalMinutes = entries
    .filter((e) => e.status !== "REJECTED")
    .reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);

  const byDay = entries.reduce<Record<string, TimeEntry[]>>((acc, e) => {
    const k = dayKey(e.entryDate);
    if (!acc[k]) acc[k] = [];
    acc[k].push(e);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="w-7 h-7"
              onClick={() => setWeekStart((d) => addDays(d, -7))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <CardTitle className="text-sm font-medium">{weekLabel}</CardTitle>
            <Button
              size="icon"
              variant="ghost"
              className="w-7 h-7"
              onClick={() => setWeekStart((d) => addDays(d, 7))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{formatMinutes(totalMinutes)} total</span>
            {isAdminOrManager && (
              <Button size="sm" className="gap-1.5" onClick={openAdd}>
                <Plus className="w-3.5 h-3.5" />
                Add Entry
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {weekDays.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEntries = byDay[key] ?? [];
          const dayMinutes = dayEntries
            .filter((e) => e.status !== "REJECTED")
            .reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);

          return (
            <div key={key} className="mb-3">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {format(day, "EEE, MMM d")}
                </span>
                {dayMinutes > 0 && (
                  <span className="text-xs text-muted-foreground">{formatMinutes(dayMinutes)}</span>
                )}
              </div>
              {dayEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground pl-1 py-1">No entries</p>
              ) : (
                <div className="space-y-1">
                  {dayEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge
                          variant="outline"
                          className={cn("text-xs shrink-0", STATUS_STYLES[entry.status] ?? "")}
                        >
                          {entry.status.charAt(0) + entry.status.slice(1).toLowerCase()}
                        </Badge>
                        <span className="font-medium truncate">{entry.category.name}</span>
                        {entry.startTime && entry.endTime && (
                          <span className="text-muted-foreground text-xs shrink-0">
                            {formatTime(new Date(entry.startTime))} – {formatTime(new Date(entry.endTime))}
                          </span>
                        )}
                        {entry.note && (
                          <span className="text-muted-foreground text-xs truncate hidden sm:inline">
                            · {entry.note}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-sm font-medium">
                          {formatMinutes(entry.durationMinutes ?? 0)}
                        </span>
                        {isAdminOrManager && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="w-6 h-6"
                              onClick={() => openEdit(entry)}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="w-6 h-6 text-destructive hover:text-destructive"
                              onClick={() => deleteEntry(entry.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Time Entry" : "Add Time Entry"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.categoryId}
                onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v ?? f.categoryId }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.filter((c) => c.isActive).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.entryDate}
                onChange={(e) => setForm((f) => ({ ...f, entryDate: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea
                rows={2}
                placeholder="Optional note"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={save} disabled={loading}>
              {editingEntry ? "Save Changes" : "Add Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
