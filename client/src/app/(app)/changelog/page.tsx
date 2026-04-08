"use client";
import { History, Tag } from "lucide-react";
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
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Changelog</h1>
        <p className="text-[var(--muted-foreground)]">Alle Aenderungen und Updates</p>
      </div>

      <div className="relative space-y-6">
        {/* Timeline line */}
        <div className="absolute left-[15px] top-0 hidden h-full w-0.5 bg-[var(--border)] md:block" />

        {changelog.map((entry) => (
          <div key={entry.version} className="relative md:pl-10">
            {/* Timeline dot */}
            <div className="absolute left-[9px] top-6 hidden h-3 w-3 rounded-full bg-[var(--primary)] md:block" />

            <Card>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-[var(--primary)]" />
                  <span className="text-xl font-bold text-[var(--foreground)]">v{entry.version}</span>
                </div>
                <span className="text-sm text-[var(--muted-foreground)]">{entry.date}</span>
                <div className="flex gap-1.5">
                  {entry.tags.map((tag) => (
                    <Badge key={tag} variant={tagColors[tag] || "outline"}>
                      <Tag className="mr-1 h-3 w-3" />
                      {tagLabels[tag] || tag}
                    </Badge>
                  ))}
                </div>
              </div>

              <h3 className="mb-3 text-lg font-semibold text-[var(--foreground)]">{entry.title}</h3>

              <ul className="space-y-1.5">
                {entry.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[var(--muted-foreground)]">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                    {change}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
