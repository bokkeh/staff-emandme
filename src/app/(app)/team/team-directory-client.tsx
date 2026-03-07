"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { LayoutGrid, List, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, displayName, initials, formatDate } from "@/lib/utils";

type Role = "ADMIN" | "MANAGER" | "STAFF";
type EmployeeStatus = "ACTIVE" | "INACTIVE";

type EmployeeWithManager = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  email: string;
  role: Role;
  status: EmployeeStatus;
  jobTitle?: string | null;
  department?: string | null;
  hourlyRateCents?: number | null;
  birthMonth?: number | null;
  birthDay?: number | null;
  profilePhotoUrl?: string | null;
  startDate?: Date | string | null;
  manager: {
    id: string;
    firstName: string;
    lastName: string;
    preferredName: string | null;
  } | null;
};

const ROLE_COLORS: Record<Role, string> = {
  ADMIN: "bg-primary/10 text-primary border-primary/20",
  MANAGER: "bg-blue-50 text-blue-700 border-blue-200",
  STAFF: "bg-muted text-muted-foreground border-border",
};

const STATUS_COLORS: Record<EmployeeStatus, string> = {
  ACTIVE: "bg-green-50 text-green-700 border-green-200",
  INACTIVE: "bg-muted text-muted-foreground border-border",
};

export function TeamDirectoryClient({
  employees,
  currentUserRole,
}: {
  employees: EmployeeWithManager[];
  currentUserRole: string | null;
}) {
  const isAdminView = currentUserRole === "ADMIN";
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterDept, setFilterDept] = useState("all");
  const [filterStatus, setFilterStatus] = useState("ACTIVE");

  const departments = useMemo(() => {
    const depts = new Set(employees.map((e) => e.department).filter(Boolean));
    return Array.from(depts) as string[];
  }, [employees]);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const name = displayName(e).toLowerCase();
      const matchSearch =
        !search ||
        name.includes(search.toLowerCase()) ||
        e.email.toLowerCase().includes(search.toLowerCase()) ||
        (e.jobTitle ?? "").toLowerCase().includes(search.toLowerCase());

      const matchRole = filterRole === "all" || e.role === filterRole;
      const matchDept = filterDept === "all" || e.department === filterDept;
      const matchStatus = filterStatus === "all" || e.status === filterStatus;

      return matchSearch && matchRole && matchDept && matchStatus;
    });
  }, [employees, search, filterRole, filterDept, filterStatus]);

  const birthdayMonth = (bm?: number | null, bd?: number | null) => {
    if (!bm || !bd) return null;
    return new Date(2000, bm - 1, bd).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search name, title, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filterRole} onValueChange={(v) => setFilterRole(v ?? "all")}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
            <SelectItem value="MANAGER">Manager</SelectItem>
            <SelectItem value="STAFF">Staff</SelectItem>
          </SelectContent>
        </Select>

        {departments.length > 0 && (
          <Select value={filterDept} onValueChange={(v) => setFilterDept(v ?? "all")}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v ?? "all")}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex rounded-lg border bg-muted/30 p-0.5 gap-0.5 ml-auto">
          <Button
            variant={view === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setView("grid")}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant={view === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setView("list")}
          >
            <List className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "person" : "people"}
      </p>

      {/* Grid view */}
      {view === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((emp) => (
            <Link
              key={emp.id}
              href={`/team/${emp.id}`}
              className="block group"
            >
              <div className="bg-card border rounded-xl p-5 hover:shadow-md transition-all hover:border-primary/20 space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar className="w-12 h-12 ring-2 ring-background shadow-sm">
                    <AvatarImage src={emp.profilePhotoUrl ?? undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {initials(displayName(emp))}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                      {displayName(emp)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {emp.jobTitle ?? emp.role}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Badge
                    variant="outline"
                    className={cn("text-xs", ROLE_COLORS[emp.role])}
                  >
                    {emp.role.charAt(0) + emp.role.slice(1).toLowerCase()}
                  </Badge>
                  {emp.status === "INACTIVE" && (
                    <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
                      Inactive
                    </Badge>
                  )}
                </div>

                {emp.department && (
                  <p className="text-xs text-muted-foreground">{emp.department}</p>
                )}

                {isAdminView && emp.hourlyRateCents != null && (
                  <p className="text-xs text-muted-foreground">
                    Rate: ${(emp.hourlyRateCents / 100).toFixed(2)}/hr
                  </p>
                )}

                {birthdayMonth(emp.birthMonth, emp.birthDay) && (
                  <p className="text-xs text-muted-foreground">
                    🎂 {birthdayMonth(emp.birthMonth, emp.birthDay)}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Title</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Department</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Manager</th>
                {isAdminView && (
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Rate</th>
                )}
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Started</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp, i) => (
                <tr
                  key={emp.id}
                  className={cn(
                    "hover:bg-muted/30 transition-colors",
                    i !== filtered.length - 1 && "border-b"
                  )}
                >
                  <td className="px-4 py-3">
                    <Link href={`/team/${emp.id}`} className="flex items-center gap-3 group">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={emp.profilePhotoUrl ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                          {initials(displayName(emp))}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium group-hover:text-primary transition-colors">
                          {displayName(emp)}
                        </p>
                        <p className="text-xs text-muted-foreground">{emp.email}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {emp.jobTitle ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {emp.department ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={cn("text-xs", ROLE_COLORS[emp.role])}
                    >
                      {emp.role.charAt(0) + emp.role.slice(1).toLowerCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {emp.manager ? displayName(emp.manager) : "—"}
                  </td>
                  {isAdminView && (
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      {emp.hourlyRateCents != null ? `$${(emp.hourlyRateCents / 100).toFixed(2)}/hr` : "�"}
                    </td>
                  )}
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {emp.startDate ? formatDate(emp.startDate) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No employees match your filters.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
