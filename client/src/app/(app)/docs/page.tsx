"use client";
import { useState } from "react";
import { BookOpen, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { docs } from "@/lib/docs";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/provider";

export default function DocsPage() {
  const t = useT("docs");
  const [activeSection, setActiveSection] = useState(docs[0]?.id || "");

  const active = docs.find((d) => d.id === activeSection);

  const renderContent = (content: string) => {
    return content.split("\n").map((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("## ")) {
        return (
          <h3 key={i} className="mb-2 mt-6 text-lg font-bold text-[var(--foreground)] first:mt-0">
            {trimmed.slice(3)}
          </h3>
        );
      }
      if (trimmed.startsWith("- **")) {
        const match = trimmed.match(/^- \*\*(.+?)\*\*\s*[-—]\s*(.+)$/);
        if (match) {
          return (
            <div key={i} className="mb-1.5 flex items-start gap-2 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
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
          <div key={i} className="mb-1.5 flex items-start gap-2 text-sm text-[var(--muted-foreground)]">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
            {trimmed.slice(2)}
          </div>
        );
      }
      if (!trimmed) return <div key={i} className="h-2" />;
      return (
        <p key={i} className="mb-2 text-sm text-[var(--muted-foreground)]">
          {trimmed}
        </p>
      );
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">{t("title")}</h1>
        <p className="text-[var(--muted-foreground)]">{t("subtitle")}</p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar */}
        <div className="w-full shrink-0 lg:w-64">
          <Card className="sticky top-4">
            <nav className="space-y-0.5">
              {docs.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    activeSection === section.id
                      ? "bg-[var(--primary)]/10 font-medium text-[var(--primary)]"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]",
                  )}
                >
                  <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 transition-transform", activeSection === section.id && "rotate-90")} />
                  {section.title}
                </button>
              ))}
            </nav>
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1">
          {active ? (
            <Card>
              <div className="mb-4 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-[var(--primary)]" />
                <h2 className="text-xl font-bold text-[var(--foreground)]">{active.title}</h2>
              </div>
              <div>{renderContent(active.content)}</div>
            </Card>
          ) : (
            <Card className="py-12 text-center">
              <BookOpen className="mx-auto mb-4 h-12 w-12 text-[var(--muted-foreground)]" />
              <p className="text-[var(--muted-foreground)]">{t("selectSection")}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
