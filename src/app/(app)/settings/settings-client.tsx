"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { cn, displayName } from "@/lib/utils";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import type { AppSettings, TimeCategory, Employee } from "@prisma/client";

type PartialEmployee = Pick<
  Employee,
  | "id" | "firstName" | "lastName" | "preferredName" | "email"
  | "role" | "status" | "jobTitle" | "department" | "managerId"
  | "hourlyRateCents"
  | "birthMonth" | "birthDay" | "birthYear" | "startDate"
  | "phone" | "profilePhotoUrl" | "preferredWorkHours"
>;

export function SettingsClient({
  settings: initialSettings,
  categories: initialCategories,
  employees: initialEmployees,
}: {
  settings: AppSettings | null;
  categories: TimeCategory[];
  employees: PartialEmployee[];
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [categories, setCategories] = useState(initialCategories);
  const [employees, setEmployees] = useState(initialEmployees);
  const [loading, setLoading] = useState(false);

  // Category add
  const [newCatName, setNewCatName] = useState("");

  // Employee dialog
  const [empDialogOpen, setEmpDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<PartialEmployee | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PartialEmployee | null>(null);
  const [empForm, setEmpForm] = useState({
    firstName: "", lastName: "", preferredName: "",
    email: "", phone: "", role: "STAFF", jobTitle: "",
    department: "", hourlyRate: "", managerId: "", startDate: "",
    birthMonth: "", birthDay: "", birthYear: "",
    status: "ACTIVE",
  });

  const openNewEmployee = () => {
    setEditingEmployee(null);
    setEmpForm({
      firstName: "", lastName: "", preferredName: "",
      email: "", phone: "", role: "STAFF", jobTitle: "",
      department: "", hourlyRate: "", managerId: "", startDate: "",
      birthMonth: "", birthDay: "", birthYear: "",
      status: "ACTIVE",
    });
    setEmpDialogOpen(true);
  };

  const openEditEmployee = (emp: PartialEmployee) => {
    setEditingEmployee(emp);
    setEmpForm({
      firstName: emp.firstName,
      lastName: emp.lastName,
      preferredName: emp.preferredName ?? "",
      email: emp.email,
      phone: emp.phone ?? "",
      role: emp.role,
      jobTitle: emp.jobTitle ?? "",
      department: emp.department ?? "",
      hourlyRate: emp.hourlyRateCents != null ? (emp.hourlyRateCents / 100).toFixed(2) : "",
      managerId: emp.managerId ?? "",
      startDate: emp.startDate ? new Date(emp.startDate).toISOString().split("T")[0] : "",
      birthMonth: emp.birthMonth ? String(emp.birthMonth) : "",
      birthDay: emp.birthDay ? String(emp.birthDay) : "",
      birthYear: emp.birthYear ? String(emp.birthYear) : "",
      status: emp.status,
    });
    setEmpDialogOpen(true);
  };

  const saveEmployee = async () => {
    setLoading(true);
    try {
      const payload = {
        firstName: empForm.firstName,
        lastName: empForm.lastName,
        preferredName: empForm.preferredName || undefined,
        email: empForm.email,
        phone: empForm.phone || undefined,
        role: empForm.role,
        jobTitle: empForm.jobTitle || undefined,
        department: empForm.department || undefined,
        hourlyRateCents: empForm.hourlyRate
          ? Math.round(Number(empForm.hourlyRate) * 100)
          : undefined,
        managerId: empForm.managerId || undefined,
        startDate: empForm.startDate || undefined,
        birthMonth: empForm.birthMonth ? Number(empForm.birthMonth) : undefined,
        birthDay: empForm.birthDay ? Number(empForm.birthDay) : undefined,
        birthYear: empForm.birthYear ? Number(empForm.birthYear) : undefined,
        status: empForm.status,
      };

      const url = editingEmployee ? `/api/employees/${editingEmployee.id}` : "/api/employees";
      const method = editingEmployee ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to save");
        return;
      }

      const saved = await res.json();
      if (editingEmployee) {
        setEmployees((prev) => prev.map((e) => (e.id === saved.id ? saved : e)));
        toast.success("Employee updated");
      } else {
        setEmployees((prev) => [...prev, saved]);
        toast.success("Employee added");
      }
      setEmpDialogOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const openDeleteEmployee = (employee: PartialEmployee) => {
    setDeleteTarget(employee);
    setDeleteDialogOpen(true);
  };

  const deleteEmployee = async (mode: "soft" | "hard") => {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/employees/${deleteTarget.id}?mode=${mode}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to delete employee");
        return;
      }

      const result = await res.json();
      if (result.softDeleted) {
        setEmployees((prev) =>
          prev.map((e) => (e.id === deleteTarget.id ? { ...e, status: "INACTIVE" } : e))
        );
        toast.success("Employee set to inactive");
      } else {
        setEmployees((prev) => prev.filter((e) => e.id !== deleteTarget.id));
        toast.success("Employee hard deleted");
      }
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (updates: Partial<typeof settings>) => {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const saved = await res.json();
      setSettings(saved);
      toast.success("Settings saved");
    } else {
      toast.error("Failed to save");
    }
  };

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCatName.trim(), sortOrder: categories.length }),
    });
    if (res.ok) {
      const cat = await res.json();
      setCategories((prev) => [...prev, cat]);
      setNewCatName("");
      toast.success("Category added");
    } else {
      toast.error("Failed to add category");
    }
  };

  const toggleCategory = async (id: string, isActive: boolean) => {
    const res = await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    if (res.ok) {
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, isActive } : c)));
    }
  };

  return (
    <Tabs defaultValue="employees" className="flex-col">
      <TabsList className="mb-4 inline-flex w-fit rounded-full bg-muted p-1">
        <TabsTrigger value="employees" className="rounded-full px-4">
          Employees
        </TabsTrigger>
        <TabsTrigger value="categories" className="rounded-full px-4">
          Time Categories
        </TabsTrigger>
        <TabsTrigger value="general" className="rounded-full px-4">
          General
        </TabsTrigger>
      </TabsList>

      {/* Employees Tab */}
      <TabsContent value="employees">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Team Members ({employees.length})</CardTitle>
              <Button size="sm" onClick={openNewEmployee} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Add Employee
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground hidden md:table-cell">Email</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground hidden lg:table-cell">Rate</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, i) => (
                  <tr key={emp.id} className={cn("hover:bg-muted/20", i !== employees.length - 1 && "border-b")}>
                    <td className="px-3 py-2.5">
                      <p className="font-medium">{displayName(emp)}</p>
                      {emp.jobTitle && <p className="text-xs text-muted-foreground">{emp.jobTitle}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">{emp.email}</td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          emp.role === "ADMIN" && "bg-primary/10 text-primary border-primary/20",
                          emp.role === "MANAGER" && "bg-blue-50 text-blue-700 border-blue-200",
                          emp.role === "STAFF" && "bg-muted text-muted-foreground"
                        )}
                      >
                        {emp.role.charAt(0) + emp.role.slice(1).toLowerCase()}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 hidden lg:table-cell text-sm text-muted-foreground">
                      {emp.hourlyRateCents != null ? `$${(emp.hourlyRateCents / 100).toFixed(2)}/hr` : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          emp.status === "ACTIVE" ? "bg-green-50 text-green-700 border-green-200" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {emp.status.charAt(0) + emp.status.slice(1).toLowerCase()}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-7 h-7"
                          onClick={() => openEditEmployee(emp)}
                          disabled={loading}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-7 h-7 text-destructive hover:text-destructive"
                          onClick={() => openDeleteEmployee(emp)}
                          disabled={loading}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Categories Tab */}
      <TabsContent value="categories">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Time Categories</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="New category name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCategory()}
              />
              <Button onClick={addCategory} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Add
              </Button>
            </div>
            <div className="space-y-1">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/30"
                >
                  <span className={cn("text-sm", !cat.isActive && "text-muted-foreground line-through")}>
                    {cat.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn("text-xs", cat.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-muted text-muted-foreground")}
                    >
                      {cat.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-7 h-7"
                      onClick={() => toggleCategory(cat.id, !cat.isActive)}
                    >
                      {cat.isActive ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* General Settings Tab */}
      <TabsContent value="general">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">General Settings</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-6">
            <div className="space-y-1.5">
              <Label>Pay Period Type (Fixed)</Label>
              <Select value="BIWEEKLY" disabled>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BIWEEKLY">Biweekly</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Pay periods are fixed to 2 weeks.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Overtime Threshold (hours/week)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  defaultValue={settings?.overtimeWeeklyHours ?? 40}
                  className="w-24"
                  onBlur={(e) => saveSettings({ overtimeWeeklyHours: Number(e.target.value) })}
                />
                <span className="text-sm text-muted-foreground">hours per week</span>
              </div>
            </div>

            <div className="flex items-center justify-between py-3 border-t">
              <div>
                <p className="text-sm font-medium">Birthdays visible to all staff</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  If off, only admins and managers see birthdays.
                </p>
              </div>
              <Switch
                checked={settings?.birthdaysVisibleToAll ?? false}
                onCheckedChange={(v) => saveSettings({ birthdaysVisibleToAll: v })}
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Employee</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              Choose how to remove{" "}
              <span className="font-medium">
                {deleteTarget ? displayName(deleteTarget) : "this employee"}
              </span>
              .
            </p>
            <p className="text-muted-foreground">
              Set Inactive keeps historical records. Hard Delete permanently removes the employee if no linked records exist.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => deleteEmployee("soft")} disabled={loading}>
              Set Inactive
            </Button>
            <Button variant="destructive" onClick={() => deleteEmployee("hard")} disabled={loading}>
              Hard Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employee dialog */}
      <Dialog open={empDialogOpen} onOpenChange={setEmpDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? "Edit Employee" : "Add Employee"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name *</Label>
                <Input
                  value={empForm.firstName}
                  onChange={(e) => setEmpForm((f) => ({ ...f, firstName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name *</Label>
                <Input
                  value={empForm.lastName}
                  onChange={(e) => setEmpForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Preferred Name</Label>
              <Input
                value={empForm.preferredName}
                onChange={(e) => setEmpForm((f) => ({ ...f, preferredName: e.target.value }))}
                placeholder="If different from first name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input
                type="email"
                value={empForm.email}
                onChange={(e) => setEmpForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  value={empForm.phone}
                  onChange={(e) => setEmpForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select
                  value={empForm.role}
                  onValueChange={(v) => setEmpForm((f) => ({ ...f, role: v ?? f.role }))}
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
                  value={empForm.jobTitle}
                  onChange={(e) => setEmpForm((f) => ({ ...f, jobTitle: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Input
                  value={empForm.department}
                  onChange={(e) => setEmpForm((f) => ({ ...f, department: e.target.value }))}
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
                value={empForm.hourlyRate}
                onChange={(e) => setEmpForm((f) => ({ ...f, hourlyRate: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={empForm.startDate}
                  onChange={(e) => setEmpForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={empForm.status}
                  onValueChange={(v) => setEmpForm((f) => ({ ...f, status: v ?? f.status }))}
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
                  min={1} max={12}
                  placeholder="1–12"
                  value={empForm.birthMonth}
                  onChange={(e) => setEmpForm((f) => ({ ...f, birthMonth: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Birth Day</Label>
                <Input
                  type="number"
                  min={1} max={31}
                  placeholder="1–31"
                  value={empForm.birthDay}
                  onChange={(e) => setEmpForm((f) => ({ ...f, birthDay: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Birth Year</Label>
                <Input
                  type="number"
                  placeholder="Optional"
                  value={empForm.birthYear}
                  onChange={(e) => setEmpForm((f) => ({ ...f, birthYear: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Manager ID</Label>
              <Select
                value={empForm.managerId || "none"}
                onValueChange={(v) => setEmpForm((f) => ({ ...f, managerId: !v || v === "none" ? "" : v }))}
              >
                <SelectTrigger><SelectValue placeholder="No manager" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No manager</SelectItem>
                  {employees
                    .filter((e) => !editingEmployee || e.id !== editingEmployee.id)
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id}>{displayName(e)}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmpDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveEmployee} disabled={loading}>
              {editingEmployee ? "Save Changes" : "Add Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
