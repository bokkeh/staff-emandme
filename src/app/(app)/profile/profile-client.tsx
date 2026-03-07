"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { displayName, formatDate, initials } from "@/lib/utils";
import { BriefcaseBusiness, Building2, Mail, Phone, Calendar, Cake, PencilLine } from "lucide-react";

type EmployeeProfile = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  email: string;
  phone?: string | null;
  role: string;
  status: string;
  jobTitle?: string | null;
  department?: string | null;
  hourlyRateCents?: number | null;
  startDate?: Date | string | null;
  birthMonth?: number | null;
  birthDay?: number | null;
  birthYear?: number | null;
  profilePhotoUrl?: string | null;
  preferredWorkHours?: string | null;
  createdAt?: Date | string;
};

export function ProfileClient({ employee: initialEmployee }: { employee: EmployeeProfile }) {
  const [employee, setEmployee] = useState(initialEmployee);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: initialEmployee.firstName ?? "",
    lastName: initialEmployee.lastName ?? "",
    preferredName: initialEmployee.preferredName ?? "",
    phone: initialEmployee.phone ?? "",
    jobTitle: initialEmployee.jobTitle ?? "",
    department: initialEmployee.department ?? "",
    preferredWorkHours: initialEmployee.preferredWorkHours ?? "",
    birthMonth: initialEmployee.birthMonth ? String(initialEmployee.birthMonth) : "",
    birthDay: initialEmployee.birthDay ? String(initialEmployee.birthDay) : "",
    birthYear: initialEmployee.birthYear ? String(initialEmployee.birthYear) : "",
  });

  const save = async () => {
    setLoading(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        preferredName: form.preferredName.trim() || null,
        phone: form.phone.trim() || null,
        jobTitle: form.jobTitle.trim() || null,
        department: form.department.trim() || null,
        preferredWorkHours: form.preferredWorkHours.trim() || null,
        birthMonth: form.birthMonth.trim() ? Number(form.birthMonth) : null,
        birthDay: form.birthDay.trim() ? Number(form.birthDay) : null,
        birthYear: form.birthYear.trim() ? Number(form.birthYear) : null,
      };

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Failed to update profile");
        return;
      }

      const updated = await res.json();
      setEmployee(updated);
      setForm({
        firstName: updated.firstName ?? "",
        lastName: updated.lastName ?? "",
        preferredName: updated.preferredName ?? "",
        phone: updated.phone ?? "",
        jobTitle: updated.jobTitle ?? "",
        department: updated.department ?? "",
        preferredWorkHours: updated.preferredWorkHours ?? "",
        birthMonth: updated.birthMonth ? String(updated.birthMonth) : "",
        birthDay: updated.birthDay ? String(updated.birthDay) : "",
        birthYear: updated.birthYear ? String(updated.birthYear) : "",
      });
      setEditing(false);
      toast.success("Profile updated");
    } finally {
      setLoading(false);
    }
  };

  const birthdayText =
    employee.birthMonth && employee.birthDay
      ? new Date(2000, employee.birthMonth - 1, employee.birthDay).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
        })
      : "-";

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <Avatar className="w-20 h-20 ring-4 ring-background shadow-sm">
                <AvatarImage src={employee.profilePhotoUrl ?? undefined} />
                <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                  {initials(displayName(employee))}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-1">
                <h2 className="text-3xl font-semibold tracking-tight">{displayName(employee)}</h2>
                <p className="text-lg text-muted-foreground">{employee.jobTitle ?? "Team Member"}</p>
                <Badge variant="secondary">{employee.department ?? "No department"}</Badge>
              </div>
            </div>

            <div className="flex gap-2">
              {editing ? (
                <>
                  <Button variant="outline" onClick={() => setEditing(false)} disabled={loading}>
                    Cancel
                  </Button>
                  <Button onClick={save} disabled={loading}>
                    Save Changes
                  </Button>
                </>
              ) : (
                <Button className="gap-2" onClick={() => setEditing(true)}>
                  <PencilLine className="w-4 h-4" />
                  Edit Profile
                </Button>
              )}
            </div>
          </div>

          <div className="mt-5 border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="w-4 h-4 shrink-0" />
              <span>{employee.email}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-4 h-4 shrink-0" />
              <span>{employee.phone ?? "-"}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Cake className="w-4 h-4 shrink-0" />
              <span>{birthdayText}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4 shrink-0" />
              <span>{employee.startDate ? formatDate(employee.startDate) : "-"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl flex items-center gap-2">
              <BriefcaseBusiness className="w-5 h-5" />
              Work Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Job Title</Label>
              <Input
                value={form.jobTitle}
                disabled={!editing}
                onChange={(e) => setForm((p) => ({ ...p, jobTitle: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input
                value={form.department}
                disabled={!editing}
                onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Work Schedule</Label>
              <Input
                value={form.preferredWorkHours}
                placeholder="Mon-Fri, 9:00 AM - 5:00 PM"
                disabled={!editing}
                onChange={(e) => setForm((p) => ({ ...p, preferredWorkHours: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input
                  value={form.firstName}
                  disabled={!editing}
                  onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input
                  value={form.lastName}
                  disabled={!editing}
                  onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Preferred Name</Label>
              <Input
                value={form.preferredName}
                disabled={!editing}
                onChange={(e) => setForm((p) => ({ ...p, preferredName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                disabled={!editing}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Birth Month</Label>
                <Input
                  value={form.birthMonth}
                  disabled={!editing}
                  onChange={(e) => setForm((p) => ({ ...p, birthMonth: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Birth Day</Label>
                <Input
                  value={form.birthDay}
                  disabled={!editing}
                  onChange={(e) => setForm((p) => ({ ...p, birthDay: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Birth Year</Label>
                <Input
                  value={form.birthYear}
                  disabled={!editing}
                  onChange={(e) => setForm((p) => ({ ...p, birthYear: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
