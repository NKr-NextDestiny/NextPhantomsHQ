"use client";
import { useState } from "react";
import {
  BookOpen, ChevronRight, Dumbbell, Trophy, Map, Users, Eye,
  BarChart3, Megaphone, StickyNote, Bell, Calendar, Shield,
  Search, Lock, FileText, Play, Crosshair, HelpCircle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { docs } from "@/lib/docs";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/provider";

const sectionIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "getting-started": HelpCircle,
  training: Dumbbell,
  matches: Trophy,
  strats: Map,
  lineup: Users,
  scouting: Eye,
  replays: Play,
  moss: Crosshair,
  polls: BarChart3,
  announcements: Megaphone,
  wiki: BookOpen,
  notes: StickyNote,
  reminders: Bell,
  availability: Calendar,
  roles: Shield,
  search: Search,
  security: Lock,
};

const sectionCategories = [
  { label: "Grundlagen", ids: ["getting-started", "roles", "search", "security"] },
  { label: "Team & Planung", ids: ["training", "matches", "availability", "reminders"] },
  { label: "Strategie & Analyse", ids: ["strats", "lineup", "scouting", "replays", "moss"] },
  { label: "Kommunikation", ids: ["announcements", "polls", "wiki", "notes"] },
];

export default function DocsPage() {
  const t = useT("wiki");
  const [activeSection, setActiveSection] = useState(docs[0]?.id || "");

  const active = docs.find((d) => d.id === activeSection);
  const SectionIcon = active ? sectionIcons[active.id] || BookOpen : BookOpen;

  const renderContent = (content: string) => {
    return content.split("\n").map((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("## ")) {
        return (
          <h3
            key={i}
            className="mb-3 mt-8 flex items-center gap-2 text-lg font-bold text-[var(--foreground)] first:mt-0 glitch-text"
          >
            <span className="h-1 w-1 rounded-full bg-[var(--primary)]" />
            {trimmed.slice(3)}
          </h3>
        );
      }
      if (trimmed.startsWith("- **")) {
        const match = trimmed.match(/^- \*\*(.+?)\*\*\s*[-—]\s*(.+)$/);
        if (match) {
          return (
            <div key={i} className="mb-2 flex items-start gap-3 text-sm animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)] animate-glow-pulse" />
              <span>
                <strong className="text-[var(--foreground)]">{match[1]}</strong>
                <span className="text-[var(--muted-foreground)]"> — {match[2]}</span>
              </span>
            </div>
          );
        }
      }
      if (trimmed.startsWith("- ")) {
        return (
          <div key={i} className="mb-2 flex items-start gap-3 text-sm text-[var(--muted-foreground)] animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]/60" />
            {trimmed.slice(2)}
          </div>
        );
      }
      if (!trimmed) return <div key={i} className="h-3" />;
      return (
        <p key={i} className="mb-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
          {trimmed}
        </p>
      );
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-gradient-to-r from-[var(--card)] to-[var(--secondary)] p-6 scanline-overlay">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[var(--primary)]/10 p-2 animate-glow-pulse">
              <FileText className="h-6 w-6 text-[var(--primary)]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--foreground)] glitch-text">{t("title")}</h1>
              <p className="text-sm text-[var(--muted-foreground)]">{t("subtitle")}</p>
            </div>
          </div>
        </div>
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[var(--primary)]/5 blur-2xl" />
        <div className="absolute -bottom-4 right-16 h-20 w-20 rounded-full bg-[var(--primary)]/3 blur-xl" />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar */}
        <div className="w-full shrink-0 lg:w-72">
          <Card className="sticky top-4 p-0 overflow-hidden">
            {sectionCategories.map((cat, catIdx) => (
              <div key={cat.label}>
                <div className="px-4 pt-4 pb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    {cat.label}
                  </span>
                </div>
                <nav className="space-y-0.5 px-2 pb-2">
                  {cat.ids
                    .map((id) => docs.find((d) => d.id === id))
                    .filter(Boolean)
                    .map((section) => {
                      const Icon = sectionIcons[section!.id] || BookOpen;
                      return (
                        <button
                          key={section!.id}
                          onClick={() => setActiveSection(section!.id)}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-all",
                            activeSection === section!.id
                              ? "bg-[var(--primary)]/10 font-medium text-[var(--primary)] card-hover-glow"
                              : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]",
                          )}
                        >
                          <Icon className={cn("h-4 w-4 shrink-0", activeSection === section!.id && "text-[var(--primary)]")} />
                          {section!.title}
                          {activeSection === section!.id && (
                            <ChevronRight className="ml-auto h-3.5 w-3.5 text-[var(--primary)]" />
                          )}
                        </button>
                      );
                    })}
                </nav>
                {catIdx < sectionCategories.length - 1 && (
                  <div className="border-b border-[var(--border)]" />
                )}
              </div>
            ))}
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1">
          {active ? (
            <Card className="animate-fade-in-left card-hover-glow" key={active.id}>
              <div className="mb-6 flex items-center gap-3 border-b border-[var(--border)] pb-4">
                <div className="rounded-lg bg-[var(--primary)]/10 p-2">
                  <SectionIcon className="h-5 w-5 text-[var(--primary)]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--foreground)] glitch-text">{active.title}</h2>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {sectionCategories.find((c) => c.ids.includes(active.id))?.label}
                  </p>
                </div>
              </div>
              <div>{renderContent(active.content)}</div>
            </Card>
          ) : (
            <Card className="py-12 text-center animate-fade-in">
              <BookOpen className="mx-auto mb-4 h-12 w-12 text-[var(--muted-foreground)]" />
              <p className="text-[var(--muted-foreground)]">{t("selectSection")}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
