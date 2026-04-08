"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Dumbbell,
  Swords,
  Trophy,
  Map,
  Users,
  Eye,
  Film,
  Shield,
  BarChart3,
  Megaphone,
  Settings,
  Menu,
  X,
  BookOpen,
  StickyNote,
  Bell,
  Calendar,
  History,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/training", label: "Training", icon: Dumbbell },
  { href: "/scrims", label: "Scrims", icon: Swords },
  { href: "/matches", label: "Matches", icon: Trophy },
  { href: "/strats", label: "Strategien", icon: Map },
  { href: "/lineup", label: "Lineups", icon: Users },
  { href: "/scouting", label: "Scouting", icon: Eye },
  { href: "/replays", label: "Replays", icon: Film },
  { href: "/moss", label: "MOSS", icon: Shield },
  { href: "/polls", label: "Umfragen", icon: BarChart3 },
  { href: "/announcements", label: "Ankuendigungen", icon: Megaphone },
  { href: "/wiki", label: "Wiki", icon: BookOpen },
  { href: "/notes", label: "Notizen", icon: StickyNote },
  { href: "/reminders", label: "Erinnerungen", icon: Bell },
  { href: "/availability", label: "Verfuegbarkeit", icon: Calendar },
  { href: "/docs", label: "Dokumentation", icon: HelpCircle },
  { href: "/changelog", label: "Changelog", icon: History },
  { href: "/settings", label: "Einstellungen", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navContent = (
    <>
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-5">
        <img src="/images/logo_icon.png" alt="Next Phantoms HQ" className="h-9 w-9" />
        <span className="text-lg font-bold text-[var(--primary)]">Next Phantoms HQ</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]",
              )}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-[var(--primary)]")} />
              {item.label}
              {isActive && (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed left-4 top-4 z-50 rounded-lg bg-[var(--card)] p-2 text-[var(--foreground)] shadow-lg lg:hidden"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[var(--border)] bg-[var(--card)] transition-transform lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {navContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[var(--border)] bg-[var(--card)] lg:flex">
        {navContent}
      </aside>
    </>
  );
}
