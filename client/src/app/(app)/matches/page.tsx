"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Trophy, Trash2, Edit2, TrendingUp, TrendingDown, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";

interface Match {
  id: string;
  opponent: string;
  date: string;
  map: string;
  scoreUs: number;
  scoreThem: number;
  result: string;
  competition?: string;
  notes?: string;
  playerStats?: any[];
  mossFiles?: any[];
  replay?: any;
}

interface GameConfig {
  maps: string[];
  characters: string[];
  playerRoles: string[];
}

function calcResult(us: number, them: number): "WIN" | "LOSS" | "DRAW" {
  if (us > them) return "WIN";
  if (us < them) return "LOSS";
  return "DRAW";
}

export default function MatchesPage() {
  const { success, error } = useToast();
  const [matches, setMatches] = useState<Match[]>([]);
  const [maps, setMaps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterMap, setFilterMap] = useState("");
  const [form, setForm] = useState({
    opponent: "", date: "", map: "", scoreUs: "0", scoreThem: "0",
    competition: "", notes: "", side: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = filterMap ? `?map=${filterMap}` : "";
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
  }, [filterMap, error]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ opponent: "", date: "", map: maps[0] || "", scoreUs: "0", scoreThem: "0", competition: "", notes: "", side: "" });
    setShowModal(true);
  };

  const openEdit = (m: Match) => {
    setEditingId(m.id);
    setForm({
      opponent: m.opponent,
      date: m.date ? new Date(m.date).toISOString().slice(0, 16) : "",
      map: m.map,
      scoreUs: String(m.scoreUs),
      scoreThem: String(m.scoreThem),
      competition: m.competition || "",
      notes: m.notes || "",
      side: "",
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const us = parseInt(form.scoreUs);
      const them = parseInt(form.scoreThem);
      const body = {
        opponent: form.opponent,
        date: form.date,
        map: form.map,
        scoreUs: us,
        scoreThem: them,
        result: calcResult(us, them),
        competition: form.competition || null,
        notes: form.notes || null,
        side: form.side || null,
      };
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

  const wins = matches.filter((m) => m.result === "WIN").length;
  const total = matches.length;
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
          <p className="text-[var(--muted-foreground)]">Match-Historie und Statistiken</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Neues Match
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-4 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">Gesamt</p>
          <p className="text-2xl font-bold text-[var(--foreground)]">{total}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">Siege</p>
          <p className="text-2xl font-bold text-green-400">{wins}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">Niederlagen</p>
          <p className="text-2xl font-bold text-red-400">{matches.filter((m) => m.result === "LOSS").length}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">Winrate</p>
          <p className={`text-2xl font-bold ${winRate >= 50 ? "text-green-400" : "text-red-400"}`}>{winRate}%</p>
        </Card>
      </div>

      {/* Map Filter */}
      {maps.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterMap("")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${!filterMap ? "bg-[var(--primary)] text-white" : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--primary)]/20"}`}
          >
            Alle
          </button>
          {maps.map((map) => (
            <button
              key={map}
              onClick={() => setFilterMap(map)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${filterMap === map ? "bg-[var(--primary)] text-white" : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--primary)]/20"}`}
            >
              {map}
            </button>
          ))}
        </div>
      )}

      {/* Match List */}
      {matches.length === 0 ? (
        <Card className="py-12 text-center">
          <Trophy className="mx-auto mb-4 h-12 w-12 text-[var(--muted-foreground)]" />
          <p className="text-[var(--muted-foreground)]">Noch keine Matches eingetragen.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => (
            <Card key={m.id} hover className="flex items-center gap-4 p-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${m.result === "WIN" ? "bg-green-500/20" : m.result === "LOSS" ? "bg-red-500/20" : "bg-yellow-500/20"}`}>
                {m.result === "WIN" ? <TrendingUp className="h-5 w-5 text-green-400" /> : m.result === "LOSS" ? <TrendingDown className="h-5 w-5 text-red-400" /> : <Trophy className="h-5 w-5 text-yellow-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--foreground)]">vs. {m.opponent}</span>
                  <Badge variant="outline">{m.map}</Badge>
                  {m.competition && <Badge variant="info">{m.competition}</Badge>}
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">{formatDate(m.date)}</p>
              </div>
              <div className="text-center">
                <span className={`text-xl font-bold ${m.result === "WIN" ? "text-green-400" : m.result === "LOSS" ? "text-red-400" : "text-yellow-400"}`}>
                  {m.scoreUs} : {m.scoreThem}
                </span>
              </div>
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
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? "Match bearbeiten" : "Neues Match"} size="lg">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Gegner" value={form.opponent} onChange={(e) => setForm({ ...form, opponent: e.target.value })} />
            <Input label="Datum & Zeit" type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Map" value={form.map} onChange={(e) => setForm({ ...form, map: e.target.value })} options={maps.map((m) => ({ value: m, label: m }))} />
            <Input label="Unser Score" type="number" value={form.scoreUs} onChange={(e) => setForm({ ...form, scoreUs: e.target.value })} />
            <Input label="Gegner Score" type="number" value={form.scoreThem} onChange={(e) => setForm({ ...form, scoreThem: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Wettbewerb" value={form.competition} onChange={(e) => setForm({ ...form, competition: e.target.value })} placeholder="z.B. Faceit League" />
            <Select label="Seite" value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value })} options={[{ value: "", label: "Keine Angabe" }, { value: "ATTACK", label: "Angriff" }, { value: "DEFENSE", label: "Verteidigung" }]} />
          </div>
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
