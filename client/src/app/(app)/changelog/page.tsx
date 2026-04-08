"use client";
import { useState } from "react";
import { History, Tag, ChevronDown, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { changelog } from "@/lib/changelog";

const tagColors: Record<string, "default" | "success" | "destructive" | "outline"> = {
  feature: "success",
  fix: "destructive",
  improvement: "default",
  breaking: "destructive",
};

const tagLabels: Record<string, string> = {
  feature: "Feature",
  fix: "Bugfix",
  improvement: "Verbesserung",
  breaking: "Breaking Change",
};

export default function ChangelogPage() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set([changelog[0]?.version]));

  const toggle = (version: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Changelog</h1>
        <p className="text-[var(--muted-foreground)]">Alle Änderungen und Updates</p>
      </div>

      <div className="relative space-y-4">
        {/* Timeline line */}
        <div className="absolute left-[15px] top-0 hidden h-full w-0.5 bg-[var(--border)] md:block" />

        {changelog.map((entry) => {
          const isOpen = expanded.has(entry.version);
          return (
            <div key={entry.version} className="relative md:pl-10">
              {/* Timeline dot */}
              <div className={`absolute left-[9px] top-5 hidden h-3 w-3 rounded-full md:block ${isOpen ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`} />

              <Card className="overflow-hidden">
                <button
                  onClick={() => toggle(entry.version)}
                  className="flex w-full items-center gap-3 text-left"
                >
                  {isOpen ? <ChevronDown className="h-5 w-5 shrink-0 text-[var(--primary)]" /> : <ChevronRight className="h-5 w-5 shrink-0 text-[var(--muted-foreground)]" />}
                  <div className="flex flex-1 flex-wrap items-center gap-3">
                    <span className="text-xl font-bold text-[var(--foreground)]">v{entry.version}</span>
                    <span className="text-sm text-[var(--muted-foreground)]">{entry.date}</span>
                    <div className="flex gap-1.5">
                      {entry.tags.map((tag) => (
                        <Badge key={tag} variant={tagColors[tag] || "outline"}>
                          <Tag className="mr-1 h-3 w-3" />
                          {tagLabels[tag] || tag}
                        </Badge>
                      ))}
                    </div>
                    <span className="text-sm font-medium text-[var(--foreground)]">{entry.title}</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="mt-4 border-t border-[var(--border)] pt-4">
                    <ul className="space-y-1.5">
                      {entry.changes.map((change, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[var(--muted-foreground)]">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                          {change}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
