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
import { BriefcaseBusiness, Building2, Mail, Phone, Calendar, Cake, PencilLine, PawPrint, HeartPulse } from "lucide-react";

type PetProfile = {
  id?: string;
  name: string;
  type: string;
  breed?: string | null;
  notes?: string | null;
  photoUrl?: string | null;
};

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
  homeAddress?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  emergencyContactNotes?: string | null;
  profilePhotoUrl?: string | null;
  preferredWorkHours?: string | null;
  createdAt?: Date | string;
  pets?: PetProfile[];
};

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("1") ? digits.slice(1, 11) : digits.slice(0, 10);
  const a = local.slice(0, 3);
  const b = local.slice(3, 6);
  const c = local.slice(6, 10);
  if (!a) return "";
  if (local.length <= 3) return `(+1) ${a}`;
  if (local.length <= 6) return `(+1) ${a}-${b}`;
  return `(+1) ${a}-${b}-${c}`;
}

function toDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function ProfileClient({ employee: initialEmployee }: { employee: EmployeeProfile }) {
  const [employee, setEmployee] = useState(initialEmployee);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const isAdmin = employee.role === "ADMIN";
  const [form, setForm] = useState({
    firstName: initialEmployee.firstName ?? "",
    lastName: initialEmployee.lastName ?? "",
    preferredName: initialEmployee.preferredName ?? "",
    phone: initialEmployee.phone ? formatPhone(initialEmployee.phone) : "",
    jobTitle: initialEmployee.jobTitle ?? "",
    department: initialEmployee.department ?? "",
    preferredWorkHours: initialEmployee.preferredWorkHours ?? "",
    birthMonth: initialEmployee.birthMonth ? String(initialEmployee.birthMonth) : "",
    birthDay: initialEmployee.birthDay ? String(initialEmployee.birthDay) : "",
    birthYear: initialEmployee.birthYear ? String(initialEmployee.birthYear) : "",
    homeAddress: initialEmployee.homeAddress ?? "",
    emergencyContactName: initialEmployee.emergencyContactName ?? "",
    emergencyContactPhone: initialEmployee.emergencyContactPhone ? formatPhone(initialEmployee.emergencyContactPhone) : "",
    emergencyContactRelation: initialEmployee.emergencyContactRelation ?? "",
    emergencyContactNotes: initialEmployee.emergencyContactNotes ?? "",
    profilePhotoUrl: initialEmployee.profilePhotoUrl ?? "",
    pets:
      initialEmployee.pets?.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        breed: p.breed ?? "",
        notes: p.notes ?? "",
        photoUrl: p.photoUrl ?? "",
      })) ?? [],
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
        homeAddress: form.homeAddress.trim() || null,
        emergencyContactName: form.emergencyContactName.trim() || null,
        emergencyContactPhone: form.emergencyContactPhone.trim() || null,
        emergencyContactRelation: form.emergencyContactRelation.trim() || null,
        emergencyContactNotes: form.emergencyContactNotes.trim() || null,
        profilePhotoUrl: form.profilePhotoUrl.trim() || null,
        pets: form.pets
          .filter((pet) => pet.name.trim() && pet.type.trim())
          .map((pet) => ({
            name: pet.name.trim(),
            type: pet.type.trim(),
            breed: pet.breed?.trim() || null,
            notes: pet.notes?.trim() || null,
            photoUrl: pet.photoUrl?.trim() || null,
          })),
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
        phone: updated.phone ? formatPhone(updated.phone) : "",
        jobTitle: updated.jobTitle ?? "",
        department: updated.department ?? "",
        preferredWorkHours: updated.preferredWorkHours ?? "",
        birthMonth: updated.birthMonth ? String(updated.birthMonth) : "",
        birthDay: updated.birthDay ? String(updated.birthDay) : "",
        birthYear: updated.birthYear ? String(updated.birthYear) : "",
        homeAddress: updated.homeAddress ?? "",
        emergencyContactName: updated.emergencyContactName ?? "",
        emergencyContactPhone: updated.emergencyContactPhone ? formatPhone(updated.emergencyContactPhone) : "",
        emergencyContactRelation: updated.emergencyContactRelation ?? "",
        emergencyContactNotes: updated.emergencyContactNotes ?? "",
        profilePhotoUrl: updated.profilePhotoUrl ?? "",
        pets:
          updated.pets?.map((p: PetProfile) => ({
            id: p.id,
            name: p.name,
            type: p.type,
            breed: p.breed ?? "",
            notes: p.notes ?? "",
            photoUrl: p.photoUrl ?? "",
          })) ?? [],
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

  const onProfilePhotoChange = async (file: File | null) => {
    if (!file) return;
    const dataUrl = await toDataUrl(file);
    setForm((p) => ({ ...p, profilePhotoUrl: dataUrl }));
  };

  const addPet = () => {
    setForm((p) => ({
      ...p,
      pets: [...p.pets, { id: undefined, name: "", type: "", breed: "", notes: "", photoUrl: "" }],
    }));
  };

  const updatePet = (index: number, next: Partial<(typeof form.pets)[number]>) => {
    setForm((p) => ({
      ...p,
      pets: p.pets.map((pet, i) => (i === index ? { ...pet, ...next } : pet)),
    }));
  };

  const removePet = (index: number) => {
    setForm((p) => ({ ...p, pets: p.pets.filter((_, i) => i !== index) }));
  };

  const onPetPhotoChange = async (index: number, file: File | null) => {
    if (!file) return;
    const dataUrl = await toDataUrl(file);
    updatePet(index, { photoUrl: dataUrl });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <Avatar className="w-20 h-20 ring-4 ring-background shadow-sm">
                <AvatarImage src={form.profilePhotoUrl || employee.profilePhotoUrl || undefined} />
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
              {editing && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="profile-photo-upload" className="text-xs text-muted-foreground">
                    Profile photo
                  </Label>
                  <Input
                    id="profile-photo-upload"
                    type="file"
                    accept="image/*"
                    className="max-w-44"
                    onChange={(e) => onProfilePhotoChange(e.target.files?.[0] ?? null)}
                  />
                </div>
              )}
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
              <span>{employee.phone ? formatPhone(employee.phone) : "-"}</span>
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
                disabled={!editing || !isAdmin}
                onChange={(e) => setForm((p) => ({ ...p, jobTitle: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input
                value={form.department}
                disabled={!editing || !isAdmin}
                onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Work Schedule</Label>
              <Input
                value={form.preferredWorkHours}
                placeholder="Mon-Fri, 9:00 AM - 5:00 PM"
                disabled={!editing || !isAdmin}
                onChange={(e) => setForm((p) => ({ ...p, preferredWorkHours: e.target.value }))}
              />
            </div>
            {!isAdmin && (
              <p className="text-xs text-muted-foreground">
                Job title, department, and work schedule are managed by admins.
              </p>
            )}
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
                onChange={(e) => setForm((p) => ({ ...p, phone: formatPhone(e.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Home Address</Label>
              <Input
                value={form.homeAddress}
                disabled={!editing}
                onChange={(e) => setForm((p) => ({ ...p, homeAddress: e.target.value }))}
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xl flex items-center gap-2">
            <HeartPulse className="w-5 h-5" />
            Emergency Contact
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Contact Name</Label>
              <Input
                value={form.emergencyContactName}
                disabled={!editing}
                onChange={(e) => setForm((p) => ({ ...p, emergencyContactName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Relationship</Label>
              <Input
                value={form.emergencyContactRelation}
                disabled={!editing}
                onChange={(e) => setForm((p) => ({ ...p, emergencyContactRelation: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input
              value={form.emergencyContactPhone}
              disabled={!editing}
              onChange={(e) => setForm((p) => ({ ...p, emergencyContactPhone: formatPhone(e.target.value) }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input
              value={form.emergencyContactNotes}
              disabled={!editing}
              onChange={(e) => setForm((p) => ({ ...p, emergencyContactNotes: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-xl flex items-center gap-2">
              <PawPrint className="w-5 h-5" />
              Pets
            </CardTitle>
            {editing && (
              <Button type="button" variant="outline" size="sm" onClick={addPet}>
                Add Pet
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.pets.length === 0 && (
            <p className="text-sm text-muted-foreground">No pets added yet.</p>
          )}
          {form.pets.map((pet, index) => (
            <div key={pet.id ?? index} className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="w-14 h-14">
                  <AvatarImage src={pet.photoUrl || undefined} />
                  <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                    PET
                  </AvatarFallback>
                </Avatar>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
                  <div className="space-y-1.5">
                    <Label>Name</Label>
                    <Input
                      value={pet.name}
                      disabled={!editing}
                      onChange={(e) => updatePet(index, { name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Input
                      value={pet.type}
                      disabled={!editing}
                      onChange={(e) => updatePet(index, { type: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Breed</Label>
                  <Input
                    value={pet.breed ?? ""}
                    disabled={!editing}
                    onChange={(e) => updatePet(index, { breed: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Photo</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={!editing}
                    onChange={(e) => onPetPhotoChange(index, e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Input
                  value={pet.notes ?? ""}
                  disabled={!editing}
                  onChange={(e) => updatePet(index, { notes: e.target.value })}
                />
              </div>
              {editing && (
                <Button type="button" variant="outline" size="sm" onClick={() => removePet(index)}>
                  Remove Pet
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
