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
  name: string;
  teamTag?: string;
  threatLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  notes?: string;
  strengths?: string;
  weaknesses?: string;
  playstyle?: string;
  updatedAt: string;
  _count?: { scoutingNotes: number };
}

const THREAT_LEVELS = [
  { value: "LOW", label: "Niedrig", color: "success", icon: Shield },
  { value: "MEDIUM", label: "Mittel", color: "warning", icon: AlertTriangle },
  { value: "HIGH", label: "Hoch", color: "destructive", icon: AlertTriangle },
  { value: "CRITICAL", label: "Kritisch", color: "destructive", icon: Skull },
] as const;

export default function ScoutingPage() {
  const [entries, setEntries] = useState<ScoutingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", threatLevel: "MEDIUM" as ScoutingEntry["threatLevel"],
    notes: "", strengths: "", weaknesses: "", playstyle: "",
    teamTag: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<ScoutingEntry[]>("/api/scouting/opponents");
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
    setForm({ name: "", threatLevel: "MEDIUM", notes: "", strengths: "", weaknesses: "", playstyle: "", teamTag: "" });
    setShowModal(true);
  };

  const openEdit = (e: ScoutingEntry) => {
    setEditingId(e.id);
    setForm({
      name: e.name,
      threatLevel: e.threatLevel,
      notes: e.notes || "",
      strengths: e.strengths || "",
      weaknesses: e.weaknesses || "",
      playstyle: e.playstyle || "",
      teamTag: e.teamTag || "",
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (editingId) {
        await api.put(`/api/scouting/opponents/${editingId}`, form);
      } else {
        await api.post("/api/scouting/opponents", form);
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
      await api.delete(`/api/scouting/opponents/${id}`);
      load();
    } catch {
      // ignore
    }
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
                      <h3 className="font-semibold text-[var(--foreground)]">{e.name}</h3>
                      {e.teamTag && <Badge variant="outline">{e.teamTag}</Badge>}
                      <Badge variant={threat.color as any}>{threat.label}</Badge>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Aktualisiert: {formatDate(e.updatedAt)}
                      {e._count && ` · ${e._count.scoutingNotes} Notizen`}
                    </p>
                  </div>
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
                    {e.playstyle && (
                      <div>
                        <h4 className="mb-1 text-sm font-medium text-[var(--foreground)]">Spielstil</h4>
                        <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-wrap">{e.playstyle}</p>
                      </div>
                    )}
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
            <Input label="Gegner" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Team-Tag" value={form.teamTag} onChange={(e) => setForm({ ...form, teamTag: e.target.value })} />
          </div>
          <Select
            label="Bedrohungsstufe"
            value={form.threatLevel}
            onChange={(e) => setForm({ ...form, threatLevel: e.target.value as any })}
            options={THREAT_LEVELS.map((t) => ({ value: t.value, label: t.label }))}
          />
          <Textarea label="Spielstil" value={form.playstyle} onChange={(e) => setForm({ ...form, playstyle: e.target.value })} />
          <Textarea label="Notizen" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Textarea label="Stärken" value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} />
            <Textarea label="Schwächen" value={form.weaknesses} onChange={(e) => setForm({ ...form, weaknesses: e.target.value })} />
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
