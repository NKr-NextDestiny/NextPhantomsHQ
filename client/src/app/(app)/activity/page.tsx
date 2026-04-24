"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { History, Shield } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";

interface ActivityItem {
  id: string;
  action: string;
  entity: string;
  message: string;
  createdAt: string;
  user?: { displayName: string };
}

interface ActivityLogResponse {
  logs: ActivityItem[];
  total: number;
  scope: "team" | "admin";
}

export default function ActivityLogPage() {
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const [scope, setScope] = useState<"team" | "admin">(() => (searchParams.get("scope") === "admin" ? "admin" : "team"));
  const [logs, setLogs] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await api.get<ActivityLogResponse>(`/api/dashboard/activity-log?scope=${scope}&limit=100`);
        if (res.data?.logs) setLogs(res.data.logs);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [scope]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Aktivitätslog</h1>
          <p className="text-[var(--muted-foreground)]">Hier siehst du die letzten Team-Aktionen im Klartext.</p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-[var(--primary)] hover:underline">
          Zurück zum Dashboard
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant={scope === "team" ? "primary" : "outline"} onClick={() => setScope("team")}>
          <History className="h-4 w-4" /> Team-Log
        </Button>
        {user?.isAdmin && (
          <Button variant={scope === "admin" ? "primary" : "outline"} onClick={() => setScope("admin")}>
            <Shield className="h-4 w-4" /> Admin-Log
          </Button>
        )}
      </div>

      <Card>
        {loading ? (
          <div className="py-8 text-sm text-[var(--muted-foreground)]">Aktivitätslog wird geladen...</div>
        ) : logs.length === 0 ? (
          <div className="py-8 text-sm text-[var(--muted-foreground)]">Noch keine Einträge vorhanden.</div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="rounded-lg bg-[var(--secondary)] p-3">
                <p className="text-sm text-[var(--foreground)]">
                  {log.user?.displayName ? `${log.user.displayName} · ` : ""}{log.message}
                </p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">{formatDate(log.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
