"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Pencil } from "lucide-react";
import { displayName } from "@/lib/utils";

type EmployeeLike = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
};

type EmployeeDetail = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  email: string;
  phone?: string | null;
  role: string;
  jobTitle?: string | null;
  department?: string | null;
  managerId?: string | null;
  hourlyRateCents?: number | null;
  birthMonth?: number | null;
  birthDay?: number | null;
  birthYear?: number | null;
  startDate?: Date | string | null;
  status: string;
};

export function TeamMemberEdit({
  employee,
  allEmployees,
}: {
  employee: EmployeeDetail;
  allEmployees: EmployeeLike[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: employee.firstName,
    lastName: employee.lastName,
    preferredName: employee.preferredName ?? "",
    email: employee.email,
    phone: employee.phone ?? "",
    role: employee.role,
    jobTitle: employee.jobTitle ?? "",
    department: employee.department ?? "",
    hourlyRate: employee.hourlyRateCents != null ? (employee.hourlyRateCents / 100).toFixed(2) : "",
    managerId: employee.managerId ?? "",
    startDate: employee.startDate ? new Date(employee.startDate).toISOString().split("T")[0] : "",
    birthMonth: employee.birthMonth ? String(employee.birthMonth) : "",
    birthDay: employee.birthDay ? String(employee.birthDay) : "",
    birthYear: employee.birthYear ? String(employee.birthYear) : "",
    status: employee.status,
  });

  const save = async () => {
    setLoading(true);
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        preferredName: form.preferredName || undefined,
        email: form.email,
        phone: form.phone || undefined,
        role: form.role,
        jobTitle: form.jobTitle || undefined,
        department: form.department || undefined,
        hourlyRateCents: form.hourlyRate ? Math.round(Number(form.hourlyRate) * 100) : undefined,
        managerId: form.managerId || undefined,
        startDate: form.startDate || undefined,
        birthMonth: form.birthMonth ? Number(form.birthMonth) : undefined,
        birthDay: form.birthDay ? Number(form.birthDay) : undefined,
        birthYear: form.birthYear ? Number(form.birthYear) : undefined,
        status: form.status,
      };

      const res = await fetch(`/api/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to save");
        return;
      }

      toast.success("Employee updated");
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <Pencil className="w-3.5 h-3.5" />
        Edit
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {displayName(employee)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name *</Label>
                <Input
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name *</Label>
                <Input
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Preferred Name</Label>
              <Input
                value={form.preferredName}
                onChange={(e) => setForm((f) => ({ ...f, preferredName: e.target.value }))}
                placeholder="If different from first name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm((f) => ({ ...f, role: v ?? f.role }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="STAFF">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Job Title</Label>
                <Input
                  value={form.jobTitle}
                  onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Input
                  value={form.department}
                  onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Hourly Rate (USD)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="e.g. 18.50"
                value={form.hourlyRate}
                onChange={(e) => setForm((f) => ({ ...f, hourlyRate: e.target.value }))}
              />
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
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v ?? f.status }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Birth Month</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  placeholder="1–12"
                  value={form.birthMonth}
                  onChange={(e) => setForm((f) => ({ ...f, birthMonth: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Birth Day</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  placeholder="1–31"
                  value={form.birthDay}
                  onChange={(e) => setForm((f) => ({ ...f, birthDay: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Birth Year</Label>
                <Input
                  type="number"
                  placeholder="Optional"
                  value={form.birthYear}
                  onChange={(e) => setForm((f) => ({ ...f, birthYear: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reports To</Label>
              <Select
                value={form.managerId || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, managerId: !v || v === "none" ? "" : v }))}
              >
                <SelectTrigger><SelectValue placeholder="No manager" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No manager</SelectItem>
                  {allEmployees
                    .filter((e) => e.id !== employee.id)
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id}>{displayName(e)}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={save} disabled={loading}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
