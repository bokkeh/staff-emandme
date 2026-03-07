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
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { cn, displayName, initials } from "@/lib/utils";
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
    <div className="flex flex-col h-full font-sans">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0"
            style={{ backgroundColor: "#E68D83", color: "#fff" }}
          >
            EM
          </div>
          <div>
            <p className="text-sidebar-foreground font-semibold text-sm leading-none">Em & Me Studio</p>
            <p className="text-xs mt-0.5" style={{ color: "#333333" }}>Staff Portal</p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {visible.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                active
                  ? "text-white"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-white/10"
              )}
              style={active ? { backgroundColor: "rgba(230,141,131,0.25)" } : undefined}
            >
              <item.icon className="w-4 h-4 shrink-0" style={active ? { color: "#E68D83" } : undefined} />
              <span>{item.label}</span>
              {active && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#E68D83" }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarImage src={userImage} />
            <AvatarFallback
              className="text-xs font-semibold"
              style={{ backgroundColor: "#E68D83", color: "#fff" }}
            >
              {initials(userName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sidebar-foreground text-xs font-medium truncate">{userName}</p>
            <p className="text-xs truncate" style={{ color: "#333333" }}>{role ?? "â€”"}</p>
          </div>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-white/10"
            style={{ color: "#333333" }}
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
      <aside className="hidden lg:flex w-56 shrink-0 flex-col bg-sidebar h-screen sticky top-0 font-sans">
        <NavContent />
      </aside>

      {/* Mobile sticky header */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-50 h-14 bg-sidebar border-b border-sidebar-border font-sans">
        <div className="h-full px-3 flex items-center justify-between gap-2">
          <button
            className="w-9 h-9 rounded-lg flex items-center justify-center text-sidebar-foreground hover:bg-black/5"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0"
              style={{ backgroundColor: "#E68D83", color: "#fff" }}
            >
              EM
            </div>
            <p className="text-sm font-semibold text-[#333333] truncate">Staff Portal</p>
          </div>

          <Link
            href={profileHref}
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-black/5"
            onClick={() => setMobileOpen(false)}
            aria-label="View profile"
          >
            <Avatar className="w-7 h-7">
              <AvatarImage src={userImage} />
              <AvatarFallback
                className="text-[10px] font-semibold"
                style={{ backgroundColor: "#E68D83", color: "#fff" }}
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
          <aside className="lg:hidden fixed top-14 left-0 z-50 w-56 h-[calc(100vh-3.5rem)] bg-sidebar shadow-xl font-sans">
            <NavContent />
          </aside>
        </>
      )}
    </>
  );
}

