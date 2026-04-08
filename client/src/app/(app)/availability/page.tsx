"use client";
import { useEffect, useState, useCallback } from "react";
import { Calendar, Save, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/provider";
import { useSearchParams } from "next/navigation";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

interface Slot {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface HeatmapData {
  slots: (Slot & { user: { id: string; displayName: string } })[];
  heatmap: Record<string, { count: number; users: { id: string; displayName: string }[] }>;
}

export default function AvailabilityPage() {
  const t = useT("availability");
  const tc = useT("common");
  const { success, error } = useToast();
  const [mySlots, setMySlots] = useState<Slot[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") === "team" ? "team" : "my") as "my" | "team";
  const [tab, setTabState] = useState<"my" | "team">(initialTab);
  const setTab = (t: "my" | "team") => {
    setTabState(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    window.history.replaceState({}, "", url.toString());
  };
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    try {
      const [myRes, heatRes] = await Promise.all([
        api.get<Slot[]>("/api/availability/me"),
        api.get<HeatmapData>("/api/availability/heatmap"),
      ]);
      if (myRes.data) {
        setMySlots(myRes.data);
        const sel = new Set<string>();
        for (const s of myRes.data) sel.add(`${s.dayOfWeek}-${s.startTime}`);
        setSelected(sel);
      }
      if (heatRes.data) setHeatmap(heatRes.data);
    } catch {
      error(tc("loadError"));
    } finally { setLoading(false); }
  }, [error]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleSlot = (day: number, hour: string) => {
    const key = `${day}-${hour}`;
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const slots: Slot[] = [];
      for (const key of selected) {
        const [d, time] = key.split("-");
        const dayOfWeek = parseInt(d);
        const startTime = time;
        const hourNum = parseInt(time);
        const endTime = `${String(hourNum + 1).padStart(2, "0")}:00`;
        slots.push({ dayOfWeek, startTime, endTime });
      }
      await api.put("/api/availability/me", { slots });
      success(tc("saved"));
      loadData();
    } catch {
      error(tc("saveError"));
    } finally { setSaving(false); }
  };

  const getHeatColor = (count: number, maxCount: number) => {
    if (count === 0) return "";
    const intensity = Math.min(count / Math.max(maxCount, 1), 1);
    if (intensity < 0.33) return "bg-green-900/30";
    if (intensity < 0.66) return "bg-green-700/40";
    return "bg-green-500/50";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--primary)]" />
      </div>
    );
  }

  const maxCount = heatmap ? Math.max(...Object.values(heatmap.heatmap).map(h => h.count), 1) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{t("title")}</h1>
          <p className="text-[var(--muted-foreground)]">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant={tab === "my" ? "primary" : "outline"} onClick={() => setTab("my")}>
            <Calendar className="h-4 w-4" /> {t("mine")}
          </Button>
          <Button variant={tab === "team" ? "primary" : "outline"} onClick={() => setTab("team")}>
            <Users className="h-4 w-4" /> {t("team")}
          </Button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 bg-[var(--card)] px-2 py-1 text-left text-[var(--muted-foreground)]">{t("time")}</th>
                {DAY_KEYS.map((key, i) => (
                  <th key={i} className="px-2 py-1 text-center text-[var(--muted-foreground)]">{t(`days.${key}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOURS.map((hour) => (
                <tr key={hour}>
                  <td className="sticky left-0 bg-[var(--card)] px-2 py-0.5 text-[var(--muted-foreground)]">{hour}</td>
                  {DAY_KEYS.map((_, dayIdx) => {
                    const key = `${dayIdx}-${hour}`;
                    if (tab === "my") {
                      const isSelected = selected.has(key);
                      return (
                        <td key={dayIdx} className="px-0.5 py-0.5">
                          <button
                            onClick={() => toggleSlot(dayIdx, hour)}
                            className={`h-6 w-full rounded transition-colors ${isSelected ? "bg-[var(--primary)]/60" : "bg-[var(--secondary)] hover:bg-[var(--secondary)]/80"}`}
                          />
                        </td>
                      );
                    } else {
                      const entry = heatmap?.heatmap[key];
                      const count = entry?.count || 0;
                      return (
                        <td key={dayIdx} className="px-0.5 py-0.5" title={entry?.users.map(u => u.displayName).join(", ") || ""}>
                          <div className={`flex h-6 items-center justify-center rounded ${getHeatColor(count, maxCount)} ${count > 0 ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}`}>
                            {count > 0 ? count : ""}
                          </div>
                        </td>
                      );
                    }
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {tab === "my" && (
          <div className="mt-4 flex justify-end border-t border-[var(--border)] pt-4">
            <Button onClick={handleSave} isLoading={saving}>
              <Save className="h-4 w-4" /> {tc("save")}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
