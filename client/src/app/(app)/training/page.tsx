"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Dumbbell, Calendar, CheckCircle, XCircle, HelpCircle, Trash2, Edit2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";

interface Training {
  id: string;
  title: string;
  type: string;
  description?: string;
  date: string;
  duration?: number;
  votes?: { available: number; unavailable: number; maybe: number; userVote?: string };
}

export default function TrainingPage() {
  const { user } = useAuthStore();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", type: "practice", description: "", date: "", duration: "90" });
  const [submitting, setSubmitting] = useState(false);

  const loadTrainings = useCallback(async () => {
    try {
      const res = await api.get<Training[]>("/api/trainings");
      if (res.data) setTrainings(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTrainings(); }, [loadTrainings]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ title: "", type: "practice", description: "", date: "", duration: "90" });
    setShowModal(true);
  };

  const openEdit = (t: Training) => {
    setEditingId(t.id);
    setForm({
      title: t.title,
      type: t.type,
      description: t.description || "",
      date: t.date ? new Date(t.date).toISOString().slice(0, 16) : "",
      duration: String(t.duration || 90),
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const body = { ...form, duration: parseInt(form.duration) || 90 };
      if (editingId) {
        await api.put(`/api/trainings/${editingId}`, body);
      } else {
        await api.post("/api/trainings", body);
      }
      setShowModal(false);
      loadTrainings();
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Training wirklich loeschen?")) return;
    try {
      await api.delete(`/api/trainings/${id}`);
      loadTrainings();
    } catch {
      // ignore
    }
  };

  const handleVote = async (trainingId: string, vote: string) => {
    try {
      await api.post(`/api/trainings/${trainingId}/vote`, { vote });
      loadTrainings();
    } catch {
      // ignore
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
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Training</h1>
          <p className="text-[var(--muted-foreground)]">Trainingseinheiten planen und verwalten</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Neues Training
        </Button>
      </div>

      {trainings.length === 0 ? (
        <Card className="py-12 text-center">
          <Dumbbell className="mx-auto mb-4 h-12 w-12 text-[var(--muted-foreground)]" />
          <p className="text-[var(--muted-foreground)]">Noch keine Trainings geplant.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {trainings.map((t) => (
            <Card key={t.id} hover>
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-[var(--foreground)]">{t.title}</h3>
                  <Badge variant="info" className="mt-1">{t.type}</Badge>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(t)} className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(t.id)} className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {t.description && (
                <p className="mb-3 text-sm text-[var(--muted-foreground)]">{t.description}</p>
              )}
              <div className="mb-3 flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                <Calendar className="h-4 w-4" />
                {formatDate(t.date)}
                {t.duration && <span>({t.duration} Min)</span>}
              </div>

              {/* Vote buttons */}
              <div className="flex gap-2 border-t border-[var(--border)] pt-3">
                <button
                  onClick={() => handleVote(t.id, "available")}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium transition-all ${t.votes?.userVote === "available" ? "bg-green-500/20 text-green-400" : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-green-500/10 hover:text-green-400"}`}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Ja {t.votes?.available ? `(${t.votes.available})` : ""}
                </button>
                <button
                  onClick={() => handleVote(t.id, "maybe")}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium transition-all ${t.votes?.userVote === "maybe" ? "bg-yellow-500/20 text-yellow-400" : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-yellow-500/10 hover:text-yellow-400"}`}
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  Vllt {t.votes?.maybe ? `(${t.votes.maybe})` : ""}
                </button>
                <button
                  onClick={() => handleVote(t.id, "unavailable")}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium transition-all ${t.votes?.userVote === "unavailable" ? "bg-red-500/20 text-red-400" : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-400"}`}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Nein {t.votes?.unavailable ? `(${t.votes.unavailable})` : ""}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? "Training bearbeiten" : "Neues Training"}>
        <div className="space-y-4">
          <Input label="Titel" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="z.B. Taktik Training" />
          <Select
            label="Typ"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            options={[
              { value: "practice", label: "Uebung" },
              { value: "review", label: "Review" },
              { value: "scrimmage", label: "Scrimmage" },
              { value: "aim_training", label: "Aim Training" },
              { value: "strat_review", label: "Strat Review" },
            ]}
          />
          <Input label="Datum & Zeit" type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Input label="Dauer (Minuten)" type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
          <Textarea label="Beschreibung" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional..." />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>Abbrechen</Button>
            <Button onClick={handleSubmit} isLoading={submitting}>{editingId ? "Speichern" : "Erstellen"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
