"use client";
import { useEffect, useState } from "react";
import { Calendar, Dumbbell, Swords, Trophy, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";

interface Stats {
  upcomingTrainings: number;
  upcomingScrims: number;
  recentMatches: number;
  teamMembers: number;
}

interface UpcomingEvent {
  id: string;
  type: "training" | "scrim" | "match";
  title: string;
  date: string;
}

interface Activity {
  id: string;
  type: string;
  description: string;
  createdAt: string;
  user?: { displayName: string };
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stats>({ upcomingTrainings: 0, upcomingScrims: 0, recentMatches: 0, teamMembers: 0 });
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, eventsRes, activityRes] = await Promise.allSettled([
          api.get<Stats>("/api/dashboard/stats"),
          api.get<UpcomingEvent[]>("/api/dashboard/upcoming"),
          api.get<Activity[]>("/api/dashboard/activity"),
        ]);
        if (statsRes.status === "fulfilled" && statsRes.value.data) setStats(statsRes.value.data);
        if (eventsRes.status === "fulfilled" && eventsRes.value.data) setEvents(eventsRes.value.data);
        if (activityRes.status === "fulfilled" && activityRes.value.data) setActivity(activityRes.value.data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const statCards = [
    { label: "Trainings", value: stats.upcomingTrainings, icon: Dumbbell, color: "text-green-400" },
    { label: "Scrims", value: stats.upcomingScrims, icon: Swords, color: "text-blue-400" },
    { label: "Matches", value: stats.recentMatches, icon: Trophy, color: "text-yellow-400" },
    { label: "Mitglieder", value: stats.teamMembers, icon: Users, color: "text-purple-400" },
  ];

  const eventTypeIcons: Record<string, typeof Dumbbell> = {
    training: Dumbbell,
    scrim: Swords,
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Willkommen, {user?.displayName}!
        </h1>
        <p className="text-[var(--muted-foreground)]">Hier ist dein Team-Überblick.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label} hover>
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
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Nächste Events</h2>
          </div>
          {events.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">Keine anstehenden Events.</p>
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
                    <Badge variant={e.type === "match" ? "warning" : e.type === "scrim" ? "info" : "success"}>
                      {e.type === "training" ? "Training" : e.type === "scrim" ? "Scrim" : "Match"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Activity */}
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Letzte Aktivität</h2>
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">Keine aktuelle Aktivität.</p>
          ) : (
            <div className="space-y-3">
              {activity.map((a) => (
                <div key={a.id} className="rounded-lg bg-[var(--secondary)] p-3">
                  <p className="text-sm text-[var(--foreground)]">{a.description}</p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {a.user?.displayName && `${a.user.displayName} - `}
                    {formatDate(a.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
