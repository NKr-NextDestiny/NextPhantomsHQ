"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Eye, Trash2, Edit2, AlertTriangle, Shield, Skull, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";

interface ScoutingEntry {
  id: string;
  opponentName: string;
  threatLevel: "low" | "medium" | "high" | "critical";
  notes?: string;
  strengths?: string;
  weaknesses?: string;
  preferredMaps?: string[];
  players?: { name: string; role: string; notes?: string }[];
  lastUpdated: string;
  author?: { displayName: string };
}

const THREAT_LEVELS = [
  { value: "low", label: "Niedrig", color: "success", icon: Shield },
  { value: "medium", label: "Mittel", color: "warning", icon: AlertTriangle },
  { value: "high", label: "Hoch", color: "destructive", icon: AlertTriangle },
  { value: "critical", label: "Kritisch", color: "destructive", icon: Skull },
] as const;

export default function ScoutingPage() {
  const [entries, setEntries] = useState<ScoutingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    opponentName: "", threatLevel: "medium" as ScoutingEntry["threatLevel"],
    notes: "", strengths: "", weaknesses: "", preferredMaps: [] as string[],
    players: [] as { name: string; role: string; notes: string }[],
  });
  const [submitting, setSubmitting] = useState(false);

  const CS_MAPS = ["Mirage", "Inferno", "Nuke", "Overpass", "Ancient", "Anubis", "Dust2", "Vertigo"];

  const load = useCallback(async () => {
    try {
      const res = await api.get<ScoutingEntry[]>("/api/scouting");
      if (res.data) setEntries(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ opponentName: "", threatLevel: "medium", notes: "", strengths: "", weaknesses: "", preferredMaps: [], players: [] });
    setShowModal(true);
  };

  const openEdit = (e: ScoutingEntry) => {
    setEditingId(e.id);
    setForm({
      opponentName: e.opponentName,
      threatLevel: e.threatLevel,
      notes: e.notes || "",
      strengths: e.strengths || "",
      weaknesses: e.weaknesses || "",
      preferredMaps: e.preferredMaps || [],
      players: e.players?.map((p) => ({ ...p, notes: p.notes || "" })) || [],
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (editingId) {
        await api.put(`/api/scouting/${editingId}`, form);
      } else {
        await api.post("/api/scouting", form);
      }
      setShowModal(false);
      load();
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Scouting-Eintrag wirklich löschen?")) return;
    try {
      await api.delete(`/api/scouting/${id}`);
      load();
    } catch {
      // ignore
    }
  };

  const addPlayer = () => {
    setForm({ ...form, players: [...form.players, { name: "", role: "", notes: "" }] });
  };

  const removePlayer = (idx: number) => {
    setForm({ ...form, players: form.players.filter((_, i) => i !== idx) });
  };

  const updatePlayer = (idx: number, field: string, value: string) => {
    setForm({ ...form, players: form.players.map((p, i) => (i === idx ? { ...p, [field]: value } : p)) });
  };

  const threatInfo = (level: string) => THREAT_LEVELS.find((t) => t.value === level) || THREAT_LEVELS[1];

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
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Scouting</h1>
          <p className="text-[var(--muted-foreground)]">Gegner analysieren und Notizen verwalten</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Neuer Eintrag
        </Button>
      </div>

      {entries.length === 0 ? (
        <Card className="py-12 text-center">
          <Eye className="mx-auto mb-4 h-12 w-12 text-[var(--muted-foreground)]" />
          <p className="text-[var(--muted-foreground)]">Noch keine Scouting-Einträge.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => {
            const threat = threatInfo(e.threatLevel);
            const ThreatIcon = threat.icon;
            const isExpanded = expandedId === e.id;
            return (
              <Card key={e.id} hover className="overflow-hidden">
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${threat.value === "low" ? "bg-green-500/20" : threat.value === "medium" ? "bg-yellow-500/20" : "bg-red-500/20"}`}>
                    <ThreatIcon className={`h-5 w-5 ${threat.value === "low" ? "text-green-400" : threat.value === "medium" ? "text-yellow-400" : "text-red-400"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[var(--foreground)]">{e.opponentName}</h3>
                      <Badge variant={threat.color as any}>{threat.label}</Badge>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)]">Aktualisiert: {formatDate(e.lastUpdated)}</p>
                  </div>
                  {e.preferredMaps && e.preferredMaps.length > 0 && (
                    <div className="hidden gap-1 md:flex">
                      {e.preferredMaps.map((m) => <Badge key={m} variant="outline">{m}</Badge>)}
                    </div>
                  )}
                  <div className="flex gap-1">
                    <button onClick={() => setExpandedId(isExpanded ? null : e.id)} className="rounded p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <button onClick={() => openEdit(e)} className="rounded p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(e.id)} className="rounded p-1.5 text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
                    {e.notes && (
                      <div>
                        <h4 className="mb-1 text-sm font-medium text-[var(--foreground)]">Notizen</h4>
                        <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-wrap">{e.notes}</p>
                      </div>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                      {e.strengths && (
                        <div>
                          <h4 className="mb-1 text-sm font-medium text-green-400">Stärken</h4>
                          <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-wrap">{e.strengths}</p>
                        </div>
                      )}
                      {e.weaknesses && (
                        <div>
                          <h4 className="mb-1 text-sm font-medium text-red-400">Schwächen</h4>
                          <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-wrap">{e.weaknesses}</p>
                        </div>
                      )}
                    </div>
                    {e.players && e.players.length > 0 && (
                      <div>
                        <h4 className="mb-2 text-sm font-medium text-[var(--foreground)]">Spieler</h4>
                        <div className="space-y-1">
                          {e.players.map((p, i) => (
                            <div key={i} className="flex items-center gap-3 rounded-lg bg-[var(--secondary)] p-2">
                              <span className="text-sm font-medium text-[var(--foreground)]">{p.name}</span>
                              {p.role && <Badge variant="outline">{p.role}</Badge>}
                              {p.notes && <span className="text-xs text-[var(--muted-foreground)]">{p.notes}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? "Scouting bearbeiten" : "Neuer Scouting-Eintrag"} size="lg">
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Gegner" value={form.opponentName} onChange={(e) => setForm({ ...form, opponentName: e.target.value })} />
            <Select
              label="Bedrohungsstufe"
              value={form.threatLevel}
              onChange={(e) => setForm({ ...form, threatLevel: e.target.value as any })}
              options={THREAT_LEVELS.map((t) => ({ value: t.value, label: t.label }))}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--foreground)]">Bevorzugte Maps</label>
            <div className="flex flex-wrap gap-2">
              {CS_MAPS.map((map) => (
                <button
                  key={map}
                  onClick={() => setForm({ ...form, preferredMaps: form.preferredMaps.includes(map) ? form.preferredMaps.filter((m) => m !== map) : [...form.preferredMaps, map] })}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${form.preferredMaps.includes(map) ? "bg-[var(--primary)] text-white" : "bg-[var(--secondary)] text-[var(--muted-foreground)]"}`}
                >
                  {map}
                </button>
              ))}
            </div>
          </div>
          <Textarea label="Notizen" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Textarea label="Stärken" value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} />
            <Textarea label="Schwächen" value={form.weaknesses} onChange={(e) => setForm({ ...form, weaknesses: e.target.value })} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-[var(--foreground)]">Spieler</label>
              <Button variant="outline" size="sm" onClick={addPlayer}><Plus className="h-3.5 w-3.5" /> Spieler</Button>
            </div>
            <div className="space-y-2">
              {form.players.map((p, idx) => (
                <div key={idx} className="flex gap-2 rounded-lg bg-[var(--secondary)] p-2">
                  <input value={p.name} onChange={(e) => updatePlayer(idx, "name", e.target.value)} placeholder="Name" className="flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm text-[var(--foreground)]" />
                  <input value={p.role} onChange={(e) => updatePlayer(idx, "role", e.target.value)} placeholder="Rolle" className="w-24 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm text-[var(--foreground)]" />
                  <input value={p.notes} onChange={(e) => updatePlayer(idx, "notes", e.target.value)} placeholder="Notiz" className="flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm text-[var(--foreground)]" />
                  <button onClick={() => removePlayer(idx)} className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--destructive)]"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>Abbrechen</Button>
            <Button onClick={handleSubmit} isLoading={submitting}>{editingId ? "Speichern" : "Erstellen"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
