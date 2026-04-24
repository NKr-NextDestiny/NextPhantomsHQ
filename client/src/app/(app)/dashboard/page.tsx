"use client";
import { useEffect, useState } from "react";
import { Calendar, Dumbbell, Trophy, Users, Database, Activity, HardDrive, BarChart3 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { useT } from "@/i18n/provider";
import Link from "next/link";

interface Stats {
  upcomingTrainings: number;
  upcomingMatches: number;
  totalMatches: number;
  teamMembers: number;
}

interface UpcomingEvent {
  id: string;
  type: "training" | "match";
  matchType?: string;
  title: string;
  date: string;
}

interface Activity {
  id: string;
  type: string;
  entity: string;
  message: string;
  createdAt: string;
  user?: { displayName: string };
}

interface AdminStats {
  totalUsers: number;
  activeUsers7d: number;
  totalTrainings: number;
  totalMatches: number;
  totalStrats: number;
  totalReplays: number;
  totalPolls: number;
  apiRequests30d: number;
  storageMb: number;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { error: showError } = useToast();
  const t = useT("dashboard");
  const tc = useT("common");
  const [stats, setStats] = useState<Stats>({ upcomingTrainings: 0, upcomingMatches: 0, totalMatches: 0, teamMembers: 0 });
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, eventsRes, activityRes, adminRes] = await Promise.allSettled([
          api.get<Stats>("/api/dashboard/stats"),
          api.get<UpcomingEvent[]>("/api/dashboard/upcoming"),
          api.get<Activity[]>("/api/dashboard/activity"),
          user?.isAdmin ? api.get<AdminStats>("/api/dashboard/admin-stats") : Promise.reject("not admin"),
        ]);
        if (statsRes.status === "fulfilled" && statsRes.value.data) setStats(statsRes.value.data);
        if (eventsRes.status === "fulfilled" && eventsRes.value.data) setEvents(eventsRes.value.data);
        if (activityRes.status === "fulfilled" && activityRes.value.data) setActivity(activityRes.value.data);
        if (adminRes.status === "fulfilled" && adminRes.value.data) setAdminStats(adminRes.value.data);
      } catch {
        showError(t("loadError"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const statCards = [
    { label: t("trainings"), value: stats.upcomingTrainings, icon: Dumbbell, color: "text-green-400" },
    { label: t("upcoming"), value: stats.upcomingMatches, icon: Trophy, color: "text-blue-400" },
    { label: t("totalMatches"), value: stats.totalMatches, icon: Trophy, color: "text-yellow-400" },
    { label: t("members"), value: stats.teamMembers, icon: Users, color: "text-purple-400" },
  ];

  const eventTypeIcons: Record<string, typeof Dumbbell> = {
    training: Dumbbell,
    match: Trophy,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)] glitch-text">
          {t("welcome", { name: user?.displayName || "" })}
        </h1>
        <p className="text-[var(--muted-foreground)]">{t("subtitle")}</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s, i) => (
          <Card key={s.label} hover className={`animate-slide-up stagger-${i + 1} card-hover-glow`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--muted-foreground)]">{s.label}</p>
                <p className="mt-1 text-3xl font-bold text-[var(--foreground)]">{s.value}</p>
              </div>
              <s.icon className={`h-10 w-10 ${s.color} opacity-60`} />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Events */}
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="text-lg font-semibold text-[var(--foreground)]">{t("upcomingEvents")}</h2>
          </div>
          {events.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">{t("noEvents")}</p>
          ) : (
            <div className="space-y-3">
              {events.map((e) => {
                const Icon = eventTypeIcons[e.type] || Calendar;
                return (
                  <div key={e.id} className="flex items-center gap-3 rounded-lg bg-[var(--secondary)] p-3">
                    <Icon className="h-5 w-5 text-[var(--primary)]" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--foreground)]">{e.title}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">{formatDate(e.date)}</p>
                    </div>
                    <Badge variant={e.type === "match" ? "info" : "success"}>
                      {e.type === "training" ? t("training") : e.matchType === "SCRIM" ? t("scrim") : t("match")}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Activity */}
        <Card>
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="text-lg font-semibold text-[var(--foreground)]">{t("recentActivity")}</h2>
            </div>
            <Link href={`/activity?scope=${user?.isAdmin ? "team" : "team"}`} className="text-sm font-medium text-[var(--primary)] hover:underline">
              Alles anzeigen
            </Link>
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">{t("noActivity")}</p>
          ) : (
            <div className="space-y-3">
              {activity.map((a) => {
                return (
                  <div key={a.id} className="rounded-lg bg-[var(--secondary)] p-3">
                    <p className="text-sm text-[var(--foreground)]">
                      {a.user?.displayName ? `${a.user.displayName} · ` : ""}{a.message}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      {formatDate(a.createdAt)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Admin Stats */}
      {adminStats && (
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="text-lg font-semibold text-[var(--foreground)]">{t("adminStats")}</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: t("totalUsers"), value: adminStats.totalUsers, icon: Users },
              { label: t("activeUsers7d"), value: adminStats.activeUsers7d, icon: Activity },
              { label: t("totalTrainings"), value: adminStats.totalTrainings, icon: Dumbbell },
              { label: t("totalStrats"), value: adminStats.totalStrats, icon: Database },
              { label: t("totalReplays"), value: adminStats.totalReplays, icon: Database },
              { label: t("totalPolls"), value: adminStats.totalPolls, icon: Database },
              { label: t("apiRequests30d"), value: adminStats.apiRequests30d, icon: Activity },
              { label: t("storage"), value: `${adminStats.storageMb} MB`, icon: HardDrive },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3 rounded-lg bg-[var(--secondary)] p-3">
                <s.icon className="h-5 w-5 text-[var(--primary)] opacity-60" />
                <div>
                  <p className="text-xs text-[var(--muted-foreground)]">{s.label}</p>
                  <p className="text-lg font-bold text-[var(--foreground)]">{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
