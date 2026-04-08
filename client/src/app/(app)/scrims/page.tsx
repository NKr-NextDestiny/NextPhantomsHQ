"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Swords, Calendar, CheckCircle, XCircle, HelpCircle, Trash2, Edit2 } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";

interface Scrim {
  id: string;
  opponent: string;
  date: string;
  format: string;
  mapPool?: string[];
  notes?: string;
  status: string;
  result?: { us: number; them: number };
  votes?: { available: number; unavailable: number; maybe: number; userVote?: string };
}

const CS_MAPS = ["Mirage", "Inferno", "Nuke", "Overpass", "Ancient", "Anubis", "Dust2", "Vertigo"];

export default function ScrimsPage() {
  const [scrims, setScrims] = useState<Scrim[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ opponent: "", date: "", format: "bo1", mapPool: [] as string[], notes: "" });
  const [resultModal, setResultModal] = useState<string | null>(null);
  const [resultForm, setResultForm] = useState({ us: "0", them: "0" });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Scrim[]>("/api/scrims");
      if (res.data) setScrims(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ opponent: "", date: "", format: "bo1", mapPool: [], notes: "" });
    setShowModal(true);
  };

  const openEdit = (s: Scrim) => {
    setEditingId(s.id);
    setForm({
      opponent: s.opponent,
      date: s.date ? new Date(s.date).toISOString().slice(0, 16) : "",
      format: s.format,
      mapPool: s.mapPool || [],
      notes: s.notes || "",
    });
    setShowModal(true);
  };

  const toggleMap = (map: string) => {
    setForm((f) => ({
      ...f,
      mapPool: f.mapPool.includes(map) ? f.mapPool.filter((m) => m !== map) : [...f.mapPool, map],
    }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (editingId) {
        await api.put(`/api/scrims/${editingId}`, form);
      } else {
        await api.post("/api/scrims", form);
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
    if (!confirm("Scrim wirklich löschen?")) return;
    try {
      await api.delete(`/api/scrims/${id}`);
      load();
    } catch {
      // ignore
    }
  };

  const handleVote = async (scrimId: string, vote: string) => {
    try {
      await api.post(`/api/scrims/${scrimId}/vote`, { vote });
      load();
    } catch {
      // ignore
    }
  };

  const handleResult = async () => {
    if (!resultModal) return;
    setSubmitting(true);
    try {
      await api.patch(`/api/scrims/${resultModal}/result`, {
        us: parseInt(resultForm.us),
        them: parseInt(resultForm.them),
      });
      setResultModal(null);
      load();
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Scrims</h1>
          <p className="text-[var(--muted-foreground)]">Scrim-Matches planen und verwalten</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Neuer Scrim
        </Button>
      </div>

      {scrims.length === 0 ? (
        <Card className="py-12 text-center">
          <Swords className="mx-auto mb-4 h-12 w-12 text-[var(--muted-foreground)]" />
          <p className="text-[var(--muted-foreground)]">Noch keine Scrims geplant.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {scrims.map((s) => (
            <Card key={s.id} hover>
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-[var(--foreground)]">vs. {s.opponent}</h3>
                  <div className="mt-1 flex gap-2">
                    <Badge variant="info">{s.format.toUpperCase()}</Badge>
                    <Badge variant={s.status === "completed" ? "success" : s.status === "cancelled" ? "destructive" : "warning"}>
                      {s.status === "completed" ? "Gespielt" : s.status === "cancelled" ? "Abgesagt" : "Geplant"}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(s)} className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mb-3 flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                <Calendar className="h-4 w-4" />
                {formatDate(s.date)}
              </div>

              {s.mapPool && s.mapPool.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1">
                  {s.mapPool.map((m) => (
                    <Badge key={m} variant="outline">{m}</Badge>
                  ))}
                </div>
              )}

              {s.result && (
                <div className="mb-3 rounded-lg bg-[var(--secondary)] p-3 text-center">
                  <span className="text-2xl font-bold text-[var(--foreground)]">
                    {s.result.us} : {s.result.them}
                  </span>
                </div>
              )}

              {!s.result && s.status !== "cancelled" && (
                <Button variant="outline" size="sm" className="mb-3 w-full" onClick={() => { setResultModal(s.id); setResultForm({ us: "0", them: "0" }); }}>
                  Ergebnis eintragen
                </Button>
              )}

              {/* Vote buttons */}
              <div className="flex gap-2 border-t border-[var(--border)] pt-3">
                <button
                  onClick={() => handleVote(s.id, "available")}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium transition-all ${s.votes?.userVote === "available" ? "bg-green-500/20 text-green-400" : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-green-500/10"}`}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  {s.votes?.available || 0}
                </button>
                <button
                  onClick={() => handleVote(s.id, "maybe")}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium transition-all ${s.votes?.userVote === "maybe" ? "bg-yellow-500/20 text-yellow-400" : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-yellow-500/10"}`}
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  {s.votes?.maybe || 0}
                </button>
                <button
                  onClick={() => handleVote(s.id, "unavailable")}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium transition-all ${s.votes?.userVote === "unavailable" ? "bg-red-500/20 text-red-400" : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-red-500/10"}`}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  {s.votes?.unavailable || 0}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? "Scrim bearbeiten" : "Neuer Scrim"}>
        <div className="space-y-4">
          <Input label="Gegner" value={form.opponent} onChange={(e) => setForm({ ...form, opponent: e.target.value })} placeholder="Teamname" />
          <Input label="Datum & Zeit" type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Select
            label="Format"
            value={form.format}
            onChange={(e) => setForm({ ...form, format: e.target.value })}
            options={[
              { value: "bo1", label: "Best of 1" },
              { value: "bo2", label: "Best of 2" },
              { value: "bo3", label: "Best of 3" },
              { value: "bo5", label: "Best of 5" },
            ]}
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--foreground)]">Map Pool</label>
            <div className="flex flex-wrap gap-2">
              {CS_MAPS.map((map) => (
                <button
                  key={map}
                  onClick={() => toggleMap(map)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${form.mapPool.includes(map) ? "bg-[var(--primary)] text-white" : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--primary)]/20"}`}
                >
                  {map}
                </button>
              ))}
            </div>
          </div>
          <Textarea label="Notizen" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>Abbrechen</Button>
            <Button onClick={handleSubmit} isLoading={submitting}>{editingId ? "Speichern" : "Erstellen"}</Button>
          </div>
        </div>
      </Modal>

      {/* Result Modal */}
      <Modal open={!!resultModal} onClose={() => setResultModal(null)} title="Ergebnis eintragen" size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Input label="Wir" type="number" value={resultForm.us} onChange={(e) => setResultForm({ ...resultForm, us: e.target.value })} className="text-center" />
            <span className="mt-6 text-xl font-bold text-[var(--muted-foreground)]">:</span>
            <Input label="Gegner" type="number" value={resultForm.them} onChange={(e) => setResultForm({ ...resultForm, them: e.target.value })} className="text-center" />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setResultModal(null)}>Abbrechen</Button>
            <Button onClick={handleResult} isLoading={submitting}>Speichern</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
