"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn, displayName, initials } from "@/lib/utils";
import { Plus, Check, X, CalendarDays } from "lucide-react";

type EmployeeLike = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  profilePhotoUrl?: string | null;
};

type ReviewerLike = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
} | null;

type TimeOffRequest = {
  id: string;
  employeeId: string;
  type: string;
  status: string;
  startDate: Date | string;
  endDate: Date | string;
  note?: string | null;
  reviewNote?: string | null;
  reviewedAt?: Date | string | null;
  createdAt: Date | string;
  employee: EmployeeLike;
  reviewedBy: ReviewerLike;
};

const TYPE_LABELS: Record<string, string> = {
  VACATION: "Vacation",
  SICK: "Sick",
  PERSONAL: "Personal",
  UNPAID: "Unpaid",
  OTHER: "Other",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-green-50 text-green-700 border-green-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-muted text-muted-foreground",
};

function dayCount(start: Date | string, end: Date | string) {
  return differenceInCalendarDays(new Date(end), new Date(start)) + 1;
}

export function TimeOffClient({
  initialRequests,
  currentEmployeeId,
  isManager,
}: {
  initialRequests: TimeOffRequest[];
  currentEmployeeId: string;
  isManager: boolean;
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [loading, setLoading] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<TimeOffRequest | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const [form, setForm] = useState({
    type: "VACATION",
    startDate: "",
    endDate: "",
    note: "",
  });

  const submitRequest = async () => {
    if (!form.startDate || !form.endDate) {
      toast.error("Please select start and end dates");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/time-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          startDate: form.startDate,
          endDate: form.endDate,
          note: form.note || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to submit request");
        return;
      }
      const created = await res.json();
      setRequests((prev) => [created, ...prev]);
      setNewOpen(false);
      setForm({ type: "VACATION", startDate: "", endDate: "", note: "" });
      toast.success("Time off request submitted");
    } finally {
      setLoading(false);
    }
  };

  const reviewRequest = async (action: "APPROVED" | "REJECTED") => {
    if (!reviewTarget) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/time-off/${reviewTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action, reviewNote: reviewNote || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to update request");
        return;
      }
      const updated = await res.json();
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setReviewOpen(false);
      setReviewTarget(null);
      setReviewNote("");
      toast.success(action === "APPROVED" ? "Request approved" : "Request rejected");
    } finally {
      setLoading(false);
    }
  };

  const cancelRequest = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/time-off/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to cancel");
        return;
      }
      const updated = await res.json();
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast.success("Request cancelled");
    } finally {
      setLoading(false);
    }
  };

  const openReview = (req: TimeOffRequest) => {
    setReviewTarget(req);
    setReviewNote("");
    setReviewOpen(true);
  };

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200">
              {pendingCount} pending
            </Badge>
          )}
        </div>
        <Button size="sm" onClick={() => setNewOpen(true)} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          New Request
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CalendarDays className="w-4 h-4" />
            {isManager ? "All Time Off Requests" : "My Requests"} ({requests.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No time off requests yet.</p>
          ) : (
            <div className="space-y-2">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors"
                >
                  {isManager && (
                    <Link href={`/team/${req.employee.id}`}>
                      <Avatar className="w-8 h-8 shrink-0 mt-0.5">
                        <AvatarImage src={req.employee.profilePhotoUrl ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                          {initials(displayName(req.employee))}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isManager && (
                        <Link href={`/team/${req.employee.id}`} className="font-medium text-sm hover:text-primary transition-colors">
                          {displayName(req.employee)}
                        </Link>
                      )}
                      <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[req.status])}>
                        {req.status.charAt(0) + req.status.slice(1).toLowerCase()}
                      </Badge>
                      <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
                        {TYPE_LABELS[req.type] ?? req.type}
                      </Badge>
                    </div>
                    <p className="text-sm mt-1 font-medium">
                      {format(new Date(req.startDate), "MMM d")} — {format(new Date(req.endDate), "MMM d, yyyy")}
                      <span className="text-xs text-muted-foreground ml-2">
                        ({dayCount(req.startDate, req.endDate)} {dayCount(req.startDate, req.endDate) === 1 ? "day" : "days"})
                      </span>
                    </p>
                    {req.note && <p className="text-xs text-muted-foreground mt-1">{req.note}</p>}
                    {req.reviewNote && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        Review note: {req.reviewNote}
                      </p>
                    )}
                    {req.reviewedBy && req.reviewedAt && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {req.status === "APPROVED" ? "Approved" : "Reviewed"} by {displayName(req.reviewedBy)} · {format(new Date(req.reviewedAt), "MMM d")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isManager && req.status === "PENDING" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        onClick={() => openReview(req)}
                        disabled={loading}
                      >
                        Review
                      </Button>
                    )}
                    {!isManager && req.status === "PENDING" && req.employeeId === currentEmployeeId && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-7 h-7 text-muted-foreground"
                        onClick={() => cancelRequest(req.id)}
                        disabled={loading}
                        title="Cancel request"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New request dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Time Off</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v ?? f.type }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
            {form.startDate && form.endDate && form.endDate >= form.startDate && (
              <p className="text-xs text-muted-foreground">
                {dayCount(form.startDate, form.endDate)} {dayCount(form.startDate, form.endDate) === 1 ? "day" : "days"} requested
              </p>
            )}
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Textarea
                placeholder="Any details about your request…"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)} disabled={loading}>Cancel</Button>
            <Button onClick={submitRequest} disabled={loading}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review dialog (manager) */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review Request</DialogTitle>
          </DialogHeader>
          {reviewTarget && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/30 space-y-1 text-sm">
                <p className="font-medium">{displayName(reviewTarget.employee)}</p>
                <p>{TYPE_LABELS[reviewTarget.type]} · {format(new Date(reviewTarget.startDate), "MMM d")} — {format(new Date(reviewTarget.endDate), "MMM d, yyyy")}</p>
                <p className="text-xs text-muted-foreground">{dayCount(reviewTarget.startDate, reviewTarget.endDate)} days</p>
                {reviewTarget.note && <p className="text-xs text-muted-foreground italic">{reviewTarget.note}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Note (optional)</Label>
                <Textarea
                  placeholder="Reason for approval or rejection…"
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)} disabled={loading}>Cancel</Button>
            <Button variant="destructive" onClick={() => reviewRequest("REJECTED")} disabled={loading} className="gap-1.5">
              <X className="w-3.5 h-3.5" />
              Reject
            </Button>
            <Button onClick={() => reviewRequest("APPROVED")} disabled={loading} className="gap-1.5">
              <Check className="w-3.5 h-3.5" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
