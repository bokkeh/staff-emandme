"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { addDays, format, startOfWeek } from "date-fns";
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
import { cn, formatMinutes, formatTime } from "@/lib/utils";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Save } from "lucide-react";

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

const STATUS_BADGE: Record<string, string> = {
  APPROVED: "bg-[#006965]/10 text-[#006965] border-[#006965]/30",
  SUBMITTED: "bg-[#E68D83]/10 text-[#c4736a] border-[#E68D83]/40",
  DRAFT: "bg-muted text-muted-foreground border-border",
  REJECTED: "bg-red-50 text-red-600 border-red-200",
};

// Subtle geometric SVG decorations per day (Mon–Sun, index 0–6)
const DAY_DECORATIONS: React.ReactNode[] = [
  // Mon – circle ring
  <svg key="mon" className="absolute inset-0 w-full h-full opacity-[0.15]" viewBox="0 0 56 56" fill="none">
    <circle cx="44" cy="12" r="14" stroke="white" strokeWidth="2.5" />
  </svg>,
  // Tue – three dots
  <svg key="tue" className="absolute inset-0 w-full h-full opacity-[0.15]" viewBox="0 0 56 56" fill="none">
    <circle cx="36" cy="12" r="3" fill="white" />
    <circle cx="44" cy="22" r="3" fill="white" />
    <circle cx="44" cy="10" r="3" fill="white" />
    <circle cx="40" cy="17" r="3" fill="white" />
  </svg>,
  // Wed – triangle
  <svg key="wed" className="absolute inset-0 w-full h-full opacity-[0.15]" viewBox="0 0 56 56" fill="none">
    <polygon points="28,4 52,48 4,48" stroke="white" strokeWidth="2.5" strokeLinejoin="round" />
  </svg>,
  // Thu – dot grid
  <svg key="thu" className="absolute inset-0 w-full h-full opacity-[0.15]" viewBox="0 0 56 56" fill="none">
    {[14, 28, 42].flatMap((x) =>
      [14, 28, 42].map((y) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="2.5" fill="white" />
      ))
    )}
  </svg>,
  // Fri – diagonal stripes
  <svg key="fri" className="absolute inset-0 w-full h-full opacity-[0.12]" viewBox="0 0 56 56" fill="none">
    <line x1="0" y1="20" x2="20" y2="0" stroke="white" strokeWidth="3" />
    <line x1="10" y1="46" x2="46" y2="10" stroke="white" strokeWidth="3" />
    <line x1="36" y1="56" x2="56" y2="36" stroke="white" strokeWidth="3" />
  </svg>,
  // Sat – X cross
  <svg key="sat" className="absolute inset-0 w-full h-full opacity-[0.15]" viewBox="0 0 56 56" fill="none">
    <line x1="38" y1="4" x2="52" y2="18" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="52" y1="4" x2="38" y2="18" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
  </svg>,
  // Sun – crescent / arc
  <svg key="sun" className="absolute inset-0 w-full h-full opacity-[0.15]" viewBox="0 0 56 56" fill="none">
    <path d="M44 8 A18 18 0 1 1 44 48 A12 12 0 1 0 44 8 Z" fill="white" />
  </svg>,
];

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} hours`;
}

type DayInput = { hours: string; minutes: string };

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
  const activeCategories = categories.filter((c) => c.isActive);

  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Bulk fill dialog state
  const [fillWeekOpen, setFillWeekOpen] = useState(false);
  const emptyWeekTime = () =>
    Object.fromEntries(weekDays.map((d) => [format(d, "yyyy-MM-dd"), { hours: "", minutes: "00" } as DayInput]));
  const [weekCategoryId, setWeekCategoryId] = useState(activeCategories[0]?.id ?? categories[0]?.id ?? "");
  const [weekNote, setWeekNote] = useState("");
  const [weekTime, setWeekTime] = useState<Record<string, DayInput>>(emptyWeekTime);

  // Single entry dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [form, setForm] = useState({
    categoryId: activeCategories[0]?.id ?? categories[0]?.id ?? "",
    entryDate: format(new Date(), "yyyy-MM-dd"),
    startTime: "",
    endTime: "",
    note: "",
  });

  const prevWeekLabel = format(addDays(weekStart, -7), "MMM d");
  const nextWeekLabel = format(addDays(weekStart, 7), "MMM d");
  const currentWeekLabel = `${format(weekDays[0], "MMM d")} — ${format(weekDays[6], "MMM d, yyyy")}`;

  const refresh = useCallback(async () => {
    const start = format(weekStart, "yyyy-MM-dd");
    const end = format(addDays(weekStart, 6), "yyyy-MM-dd");
    const res = await fetch(
      `/api/time/entries?employeeId=${targetEmployeeId}&startDate=${start}&endDate=${end}`
    );
    if (res.ok) setEntries(await res.json());
  }, [weekStart, targetEmployeeId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    setWeekTime(emptyWeekTime());
    setWeekNote("");
    setWeekCategoryId(activeCategories[0]?.id ?? categories[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const byDay = entries.reduce<Record<string, TimeEntry[]>>((acc, e) => {
    const k = new Date(e.entryDate).toISOString().slice(0, 10);
    if (!acc[k]) acc[k] = [];
    acc[k].push(e);
    return acc;
  }, {});

  const totalMinutes = entries
    .filter((e) => e.status !== "REJECTED")
    .reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);

  // --- Bulk weekly submit ---
  const handleWeeklySubmit = async () => {
    if (!weekCategoryId) { toast.error("Select a category"); return; }
    const daysPayload = weekDays.map((day) => {
      const key = format(day, "yyyy-MM-dd");
      const d = weekTime[key] ?? { hours: "", minutes: "00" };
      const h = d.hours ? Number(d.hours) : 0;
      const m = Number(d.minutes || "0");
      const total = Math.round((h * 60 + m) / 15) * 15;
      return { entryDate: key, minutes: total };
    });
    if (!daysPayload.some((d) => d.minutes > 0)) {
      toast.error("Enter hours for at least one day");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/time/timesheet-week", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: targetEmployeeId,
          categoryId: weekCategoryId,
          note: weekNote || undefined,
          days: daysPayload,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to submit timesheet");
        return;
      }
      const data = await res.json();
      toast.success(`${data.count} ${data.count === 1 ? "entry" : "entries"} saved`);
      setWeekTime(emptyWeekTime());
      setWeekNote("");
      setFillWeekOpen(false);
      await refresh();
    } finally {
      setLoading(false);
    }
  };

  // --- Single entry dialog ---
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
      entryDate: new Date(entry.entryDate).toISOString().slice(0, 10),
      startTime: entry.startTime ? format(new Date(entry.startTime), "HH:mm") : "",
      endTime: entry.endTime ? format(new Date(entry.endTime), "HH:mm") : "",
      note: entry.note ?? "",
    });
    setDialogOpen(true);
  };

  const saveEntry = async () => {
    if (!form.startTime || !form.endTime) { toast.error("Start and end time are required"); return; }
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
        if (!res.ok) { toast.error((await res.json()).error ?? "Failed to save"); return; }
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
        if (!res.ok) { toast.error((await res.json()).error ?? "Failed to create entry"); return; }
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

  return (
    <>
      {/* Weekly Record card */}
      <div className="rounded-2xl overflow-hidden shadow-md border border-border/40 bg-card">

        {/* ── Header ── */}
        <div className="bg-[#14211f] px-5 pt-5 pb-4">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E68D83] mb-3">
            Weekly Record
          </p>
          <div className="flex items-center justify-between gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="w-8 h-8 text-white/50 hover:text-white hover:bg-white/10 shrink-0"
              onClick={() => setWeekStart((d) => addDays(d, -7))}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>

            <div className="flex items-center gap-3 text-sm min-w-0 overflow-hidden">
              <span className="text-white/35 text-xs shrink-0 hidden sm:inline">{prevWeekLabel}</span>
              <span className="text-white font-semibold text-sm text-center leading-tight">
                {currentWeekLabel}
              </span>
              <span className="text-white/35 text-xs shrink-0 hidden sm:inline">{nextWeekLabel}</span>
            </div>

            <Button
              size="icon"
              variant="ghost"
              className="w-8 h-8 text-white/50 hover:text-white hover:bg-white/10 shrink-0"
              onClick={() => setWeekStart((d) => addDays(d, 7))}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          <p className="text-center text-white/35 text-[11px] mt-2">
            {totalMinutes > 0 ? `${formatMinutes(totalMinutes)} logged this week` : "No entries yet"}
          </p>
        </div>

        {/* ── Day rows ── */}
        <div className="divide-y divide-border/60">
          {weekDays.map((day, idx) => {
            const key = format(day, "yyyy-MM-dd");
            const dayEntries = byDay[key] ?? [];
            const isWeekend = idx >= 5;

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
                  {DAY_DECORATIONS[idx]}
                  <span className="text-white text-[11px] font-bold uppercase tracking-wider z-10 leading-none mb-0.5">
                    {format(day, "EEE")}
                  </span>
                  <span className="text-white/40 text-[9px] z-10 leading-none">{format(day, "d")}</span>
                </div>

                {/* Entry content */}
                <div className="flex-1 min-w-0 self-center">
                  {dayEntries.length === 0 ? (
                    <span className="text-muted-foreground/30 font-semibold text-base tracking-[0.3em]">
                      — — —
                    </span>
                  ) : (
                    <div className="space-y-2.5">
                      {dayEntries.map((entry) => (
                        <div key={entry.id} className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            {entry.durationMinutes ? (
                              <p className="text-sm font-semibold text-foreground leading-tight">
                                {formatDuration(entry.durationMinutes)}
                              </p>
                            ) : null}

                            {entry.startTime && entry.endTime && (
                              <p className="text-xs text-muted-foreground leading-snug">
                                {format(new Date(entry.startTime), "h:mm a")} to{" "}
                                {format(new Date(entry.endTime), "h:mm a")}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              <Badge
                                variant="outline"
                                className="text-[10px] h-[18px] px-1.5 border-border/60 text-muted-foreground"
                              >
                                {entry.category.name}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={cn("text-[10px] h-[18px] px-1.5", STATUS_BADGE[entry.status] ?? STATUS_BADGE.DRAFT)}
                              >
                                {entry.status.charAt(0) + entry.status.slice(1).toLowerCase()}
                              </Badge>
                              {entry.note && (
                                <span className="text-[10px] text-muted-foreground/70 truncate max-w-[120px]">
                                  · {entry.note}
                                </span>
                              )}
                            </div>
                          </div>

                          {isAdminOrManager && (
                            <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="w-7 h-7 text-muted-foreground/60 hover:text-foreground"
                                onClick={() => openEdit(entry)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="w-7 h-7 text-muted-foreground/60 hover:text-destructive"
                                onClick={() => deleteEntry(entry.id)}
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

        {/* ── Footer actions ── */}
        {isAdminOrManager && (
          <div className="px-5 py-3.5 border-t border-border/50 flex items-center justify-between bg-muted/20">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-8"
              onClick={() => setFillWeekOpen(true)}
            >
              <Save className="w-3.5 h-3.5" />
              Fill Week
            </Button>
            <Button
              size="sm"
              className="gap-1.5 h-8 bg-[#E68D83] hover:bg-[#d4786e] text-white border-0 shadow-sm"
              onClick={openAdd}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Entry
            </Button>
          </div>
        )}
      </div>

      {/* ── Bulk week fill dialog ── */}
      <Dialog open={fillWeekOpen} onOpenChange={setFillWeekOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Fill Week — {format(weekDays[0], "MMM d")} to {format(weekDays[6], "MMM d")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={weekCategoryId} onValueChange={(v) => setWeekCategoryId(v ?? weekCategoryId)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id} disabled={!c.isActive}>
                        {c.name}{!c.isActive ? " (inactive)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Note (optional)</Label>
                <Input
                  className="h-8 text-sm"
                  placeholder="e.g. project name"
                  value={weekNote}
                  onChange={(e) => setWeekNote(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {weekDays.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const d = weekTime[key] ?? { hours: "", minutes: "00" };
                const dayTotal = (byDay[key] ?? [])
                  .filter((e) => e.status !== "REJECTED")
                  .reduce((s, e) => s + (e.durationMinutes ?? 0), 0);

                return (
                  <div key={key} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">{format(day, "EEE")}</span>
                    <span className="text-[10px] text-muted-foreground">{format(day, "d")}</span>
                    <Input
                      type="number"
                      min={0}
                      max={24}
                      step={0.25}
                      placeholder="0"
                      className="h-9 text-center text-sm px-1"
                      value={d.hours}
                      onChange={(e) =>
                        setWeekTime((prev) => ({
                          ...prev,
                          [key]: { ...d, hours: e.target.value },
                        }))
                      }
                    />
                    {dayTotal > 0 && (
                      <span className="text-[10px] text-muted-foreground">{formatMinutes(dayTotal)}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">Enter decimal hours per day (e.g. 7.5 = 7h 30m). Rounds to nearest 15 min.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFillWeekOpen(false)} disabled={loading}>Cancel</Button>
            <Button onClick={handleWeeklySubmit} disabled={loading} className="bg-[#E68D83] hover:bg-[#d4786e] text-white border-0">
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Save Week
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Single entry dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Entry" : "Add Entry"}</DialogTitle>
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
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id} disabled={!c.isActive}>
                      {c.name}{!c.isActive ? " (inactive)" : ""}
                    </SelectItem>
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
            <Button
              onClick={saveEntry}
              disabled={loading}
              className="bg-[#E68D83] hover:bg-[#d4786e] text-white border-0"
            >
              {editingEntry ? "Save Changes" : "Add Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
