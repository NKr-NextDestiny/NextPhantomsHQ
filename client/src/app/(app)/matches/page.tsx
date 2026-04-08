"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Trophy, Trash2, Edit2, TrendingUp, TrendingDown, Eye, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { useAuthStore } from "@/lib/auth-store";

type MatchType = "SCRIM" | "TOURNAMENT" | "LEAGUE" | "FRIENDLY" | "OTHER";

interface MatchVote {
  id: string;
  status: string;
  userId: string;
  user: { displayName: string };
}

interface Match {
  id: string;
  type: MatchType;
  opponent: string;
  date: string;
  map?: string | null;
  scoreUs?: number | null;
  scoreThem?: number | null;
  result?: string | null;
  competition?: string | null;
  notes?: string | null;
  meetTime?: string | null;
  endDate?: string | null;
  mapPool?: string[];
  format?: string | null;
  contactInfo?: string | null;
  serverRegion?: string | null;
  votes?: MatchVote[];
}

interface GameConfig {
  maps: string[];
}

const TYPE_LABELS: Record<MatchType, string> = {
  SCRIM: "Scrim",
  TOURNAMENT: "Turnier",
  LEAGUE: "Liga",
  FRIENDLY: "Freundschaftlich",
  OTHER: "Sonstige",
};

const TYPE_COLORS: Record<MatchType, string> = {
  SCRIM: "info",
  TOURNAMENT: "warning",
  LEAGUE: "default",
  FRIENDLY: "success",
  OTHER: "outline",
};

function calcResult(us: number, them: number): "WIN" | "LOSS" | "DRAW" {
  if (us > them) return "WIN";
  if (us < them) return "LOSS";
  return "DRAW";
}

export default function MatchesPage() {
  const { success, error } = useToast();
  const { user } = useAuthStore();
  const [matches, setMatches] = useState<Match[]>([]);
  const [maps, setMaps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<MatchType | "">("");
  const [form, setForm] = useState({
    type: "OTHER" as MatchType,
    opponent: "", date: "", map: "", scoreUs: "", scoreThem: "",
    competition: "", notes: "", meetTime: "", endDate: "",
    mapPool: [] as string[], format: "", contactInfo: "", serverRegion: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = filterType ? `?type=${filterType}` : "";
      const [matchRes, configRes] = await Promise.allSettled([
        api.get<Match[]>(`/api/matches${params}`),
        api.get<GameConfig>("/api/team/config"),
      ]);

      if (matchRes.status === "fulfilled" && matchRes.value.data) setMatches(matchRes.value.data);
      else if (matchRes.status === "rejected") error("Fehler beim Laden");
      if (configRes.status === "fulfilled" && configRes.value.data) setMaps(configRes.value.data.maps);
    } catch {
      error("Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, [filterType, error]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      type: "OTHER", opponent: "", date: "", map: maps[0] || "", scoreUs: "", scoreThem: "",
      competition: "", notes: "", meetTime: "", endDate: "",
      mapPool: [], format: "", contactInfo: "", serverRegion: "",
    });
    setShowModal(true);
  };

  const openEdit = (m: Match) => {
    setEditingId(m.id);
    setForm({
      type: m.type,
      opponent: m.opponent,
      date: m.date ? new Date(m.date).toISOString().slice(0, 16) : "",
      map: m.map || "",
      scoreUs: m.scoreUs != null ? String(m.scoreUs) : "",
      scoreThem: m.scoreThem != null ? String(m.scoreThem) : "",
      competition: m.competition || "",
      notes: m.notes || "",
      meetTime: m.meetTime ? new Date(m.meetTime).toISOString().slice(0, 16) : "",
      endDate: m.endDate ? new Date(m.endDate).toISOString().slice(0, 16) : "",
      mapPool: m.mapPool || [],
      format: m.format || "",
      contactInfo: m.contactInfo || "",
      serverRegion: m.serverRegion || "",
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const hasScores = form.scoreUs !== "" && form.scoreThem !== "";
      const us = hasScores ? parseInt(form.scoreUs) : null;
      const them = hasScores ? parseInt(form.scoreThem) : null;

      const body: Record<string, unknown> = {
        type: form.type,
        opponent: form.opponent,
        date: form.date,
        map: form.map || null,
        scoreUs: us,
        scoreThem: them,
        result: us != null && them != null ? calcResult(us, them) : null,
        competition: form.competition || null,
        notes: form.notes || null,
      };

      // Scrim-specific fields
      if (form.type === "SCRIM") {
        body.meetTime = form.meetTime || null;
        body.endDate = form.endDate || null;
        body.mapPool = form.mapPool;
        body.format = form.format || null;
        body.contactInfo = form.contactInfo || null;
        body.serverRegion = form.serverRegion || null;
      }

      if (editingId) {
        await api.put(`/api/matches/${editingId}`, body);
        success("Gespeichert");
      } else {
        await api.post("/api/matches", body);
        success("Match erstellt");
      }
      setShowModal(false);
      load();
    } catch {
      error("Fehler beim Speichern");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Match wirklich löschen?")) return;
    try {
      await api.delete(`/api/matches/${id}`);
      success("Gelöscht");
      load();
    } catch {
      error("Fehler beim Löschen");
    }
  };

  const handleVote = async (matchId: string, status: "AVAILABLE" | "UNAVAILABLE" | "MAYBE") => {
    try {
      await api.post(`/api/matches/${matchId}/vote`, { status });
      success("Abstimmung gespeichert");
      load();
    } catch {
      error("Fehler beim Abstimmen");
    }
  };

  const toggleMapPool = (map: string) => {
    setForm(f => ({
      ...f,
      mapPool: f.mapPool.includes(map) ? f.mapPool.filter(m => m !== map) : [...f.mapPool, map],
    }));
  };

  // Stats based on filtered matches (only those with results)
  const matchesWithResult = matches.filter(m => m.result);
  const wins = matchesWithResult.filter(m => m.result === "WIN").length;
  const losses = matchesWithResult.filter(m => m.result === "LOSS").length;
  const total = matchesWithResult.length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Matches</h1>
          <p className="text-[var(--muted-foreground)]">Match-Historie, Scrims und Statistiken</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Neues Match
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-4 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">Gesamt</p>
          <p className="text-2xl font-bold text-[var(--foreground)]">{matches.length}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">Siege</p>
          <p className="text-2xl font-bold text-green-400">{wins}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">Niederlagen</p>
          <p className="text-2xl font-bold text-red-400">{losses}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">Winrate</p>
          <p className={`text-2xl font-bold ${winRate >= 50 ? "text-green-400" : "text-red-400"}`}>{winRate}%</p>
        </Card>
      </div>

      {/* Type Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterType("")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${!filterType ? "bg-[var(--primary)] text-white" : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--primary)]/20"}`}
        >
          Alle
        </button>
        {(Object.entries(TYPE_LABELS) as [MatchType, string][]).map(([type, label]) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${filterType === type ? "bg-[var(--primary)] text-white" : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--primary)]/20"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Match List */}
      {matches.length === 0 ? (
        <Card className="py-12 text-center">
          <Trophy className="mx-auto mb-4 h-12 w-12 text-[var(--muted-foreground)]" />
          <p className="text-[var(--muted-foreground)]">Noch keine Matches eingetragen.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => {
            const hasResult = m.result != null;
            const myVote = m.votes?.find(v => v.userId === user?.id);
            return (
              <Card key={m.id} hover className="p-4">
                <div className="flex items-center gap-4">
                  {hasResult ? (
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${m.result === "WIN" ? "bg-green-500/20" : m.result === "LOSS" ? "bg-red-500/20" : "bg-yellow-500/20"}`}>
                      {m.result === "WIN" ? <TrendingUp className="h-5 w-5 text-green-400" /> : m.result === "LOSS" ? <TrendingDown className="h-5 w-5 text-red-400" /> : <Trophy className="h-5 w-5 text-yellow-400" />}
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--secondary)]">
                      <Trophy className="h-5 w-5 text-[var(--muted-foreground)]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[var(--foreground)]">vs. {m.opponent}</span>
                      <Badge variant={TYPE_COLORS[m.type] as any}>{TYPE_LABELS[m.type]}</Badge>
                      {m.map && <Badge variant="outline">{m.map}</Badge>}
                      {m.mapPool && m.mapPool.length > 0 && !m.map && (
                        <span className="text-xs text-[var(--muted-foreground)]">{m.mapPool.length} Maps</span>
                      )}
                      {m.competition && <Badge variant="info">{m.competition}</Badge>}
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)]">{formatDate(m.date)}</p>
                  </div>
                  {hasResult && (
                    <div className="text-center">
                      <span className={`text-xl font-bold ${m.result === "WIN" ? "text-green-400" : m.result === "LOSS" ? "text-red-400" : "text-yellow-400"}`}>
                        {m.scoreUs} : {m.scoreThem}
                      </span>
                    </div>
                  )}
                  {/* Vote counts for scrims */}
                  {m.type === "SCRIM" && m.votes && m.votes.length > 0 && (
                    <div className="flex gap-2 text-xs">
                      <span className="text-green-400">{m.votes.filter(v => v.status === "AVAILABLE").length} ✓</span>
                      <span className="text-red-400">{m.votes.filter(v => v.status === "UNAVAILABLE").length} ✗</span>
                      <span className="text-yellow-400">{m.votes.filter(v => v.status === "MAYBE").length} ?</span>
                    </div>
                  )}
                  <div className="flex gap-1">
                    <Link href={`/matches/${m.id}`} className="rounded p-1.5 text-[var(--muted-foreground)] hover:text-[var(--primary)]">
                      <Eye className="h-4 w-4" />
                    </Link>
                    <button onClick={() => openEdit(m)} className="rounded p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(m.id)} className="rounded p-1.5 text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {/* Quick vote for scrims without result */}
                {m.type === "SCRIM" && !hasResult && (
                  <div className="mt-3 flex items-center gap-2 border-t border-[var(--border)] pt-3">
                    <span className="text-xs text-[var(--muted-foreground)]">Teilnahme:</span>
                    <button
                      onClick={() => handleVote(m.id, "AVAILABLE")}
                      className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-all ${myVote?.status === "AVAILABLE" ? "bg-green-500/20 text-green-400" : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-green-400"}`}
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Dabei
                    </button>
                    <button
                      onClick={() => handleVote(m.id, "MAYBE")}
                      className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-all ${myVote?.status === "MAYBE" ? "bg-yellow-500/20 text-yellow-400" : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-yellow-400"}`}
                    >
                      <HelpCircle className="h-3.5 w-3.5" /> Vielleicht
                    </button>
                    <button
                      onClick={() => handleVote(m.id, "UNAVAILABLE")}
                      className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-all ${myVote?.status === "UNAVAILABLE" ? "bg-red-500/20 text-red-400" : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-red-400"}`}
                    >
                      <XCircle className="h-3.5 w-3.5" /> Nein
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? "Match bearbeiten" : "Neues Match"} size="lg">
        <div className="space-y-4">
          {/* Type selection */}
          <Select
            label="Typ"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as MatchType })}
            options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Gegner" value={form.opponent} onChange={(e) => setForm({ ...form, opponent: e.target.value })} />
            <Input label="Datum & Zeit" type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>

          {/* Scrim-specific fields */}
          {form.type === "SCRIM" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Treffzeit" type="datetime-local" value={form.meetTime} onChange={(e) => setForm({ ...form, meetTime: e.target.value })} />
                <Input label="Ende" type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Format" value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} placeholder="z.B. BO3" />
                <Input label="Server-Region" value={form.serverRegion} onChange={(e) => setForm({ ...form, serverRegion: e.target.value })} placeholder="z.B. EU West" />
              </div>
              <Input label="Kontakt" value={form.contactInfo} onChange={(e) => setForm({ ...form, contactInfo: e.target.value })} placeholder="Discord o.ä." />
              {/* Map Pool */}
              {maps.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-[var(--foreground)]">Map-Pool</label>
                  <div className="flex flex-wrap gap-2">
                    {maps.map((map) => (
                      <button
                        key={map}
                        type="button"
                        onClick={() => toggleMapPool(map)}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${form.mapPool.includes(map) ? "bg-[var(--primary)] text-white" : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--primary)]/20"}`}
                      >
                        {map}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Score fields (optional for scrims, shown for all types) */}
          {form.type !== "SCRIM" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Select label="Map" value={form.map} onChange={(e) => setForm({ ...form, map: e.target.value })} options={[{ value: "", label: "— Keine —" }, ...maps.map(m => ({ value: m, label: m }))]} />
              <Input label="Unser Score" type="number" value={form.scoreUs} onChange={(e) => setForm({ ...form, scoreUs: e.target.value })} />
              <Input label="Gegner Score" type="number" value={form.scoreThem} onChange={(e) => setForm({ ...form, scoreThem: e.target.value })} />
            </div>
          )}

          <Input label="Wettbewerb" value={form.competition} onChange={(e) => setForm({ ...form, competition: e.target.value })} placeholder="z.B. Faceit League" />
          <Textarea label="Notizen" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>Abbrechen</Button>
            <Button onClick={handleSubmit} isLoading={submitting}>{editingId ? "Speichern" : "Erstellen"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
