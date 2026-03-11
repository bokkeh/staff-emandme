"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Clock,
  Users,
  DollarSign,
  UserCircle2,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState } from "react";
import type { Role } from "@prisma/client";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: Role[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Profile", href: "/profile", icon: UserCircle2 },
  { label: "Time Tracking", href: "/time", icon: Clock },
  { label: "Team Directory", href: "/team", icon: Users },
  { label: "Payroll", href: "/payroll", icon: DollarSign, roles: ["ADMIN", "MANAGER"] },
  { label: "Settings", href: "/settings", icon: Settings, roles: ["ADMIN"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = (session?.user as { role?: Role })?.role;

  const visible = navItems.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  );

  const userName =
    session?.user?.name ??
    (session?.user?.email ? session.user.email.split("@")[0] : "Staff");

  const userImage = session?.user?.image ?? undefined;
  const profileHref = "/profile";

  const NavContent = () => (
    <div className="flex h-full flex-col font-sans">
      {/* Brand */}
      <div className="border-b border-sidebar-border px-5 py-6">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground shadow-sm"
          >
            EM
          </div>
          <div>
            <p className="text-sm font-semibold leading-none text-sidebar-foreground">Em & Me Studio</p>
            <p className="mt-1 text-xs text-sidebar-foreground/60">Staff Portal</p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {visible.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-sidebar-primary/25 bg-sidebar-primary/15 text-sidebar-foreground"
                  : "border-transparent text-sidebar-foreground/70 hover:bg-sidebar-foreground/8 hover:text-sidebar-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-sidebar-primary" : "text-sidebar-foreground/60"
                )}
              />
              <span>{item.label}</span>
              {active && (
                <div className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-sidebar-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarImage src={userImage} />
            <AvatarFallback
              className="bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground"
            >
              {initials(userName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-medium text-sidebar-foreground">{userName}</p>
            <p className="truncate text-xs text-sidebar-foreground/60">{role ?? "-"}</p>
          </div>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/65 transition-colors hover:bg-sidebar-foreground/8 hover:text-sidebar-foreground"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar font-sans lg:flex">
        <NavContent />
      </aside>

      {/* Mobile sticky header */}
      <header className="fixed inset-x-0 top-0 z-50 h-14 border-b border-sidebar-border bg-sidebar font-sans lg:hidden">
        <div className="flex h-full items-center justify-between gap-2 px-3">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground hover:bg-sidebar-foreground/8"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-[10px] font-bold text-sidebar-primary-foreground"
            >
              EM
            </div>
            <p className="truncate text-sm font-semibold text-sidebar-foreground">Staff Portal</p>
          </div>

          <Link
            href={profileHref}
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-sidebar-foreground/8"
            onClick={() => setMobileOpen(false)}
            aria-label="View profile"
          >
            <Avatar className="w-7 h-7">
              <AvatarImage src={userImage} />
              <AvatarFallback
                className="bg-sidebar-primary text-[10px] font-semibold text-sidebar-primary-foreground"
              >
                {initials(userName)}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </header>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed left-0 top-14 z-50 h-[calc(100vh-3.5rem)] w-64 border-r border-sidebar-border bg-sidebar shadow-xl font-sans lg:hidden">
            <NavContent />
          </aside>
        </>
      )}
    </>
  );
}

