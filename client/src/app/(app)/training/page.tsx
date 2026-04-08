"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Dumbbell, Calendar, Clock, CheckCircle, XCircle, HelpCircle, Trash2, Edit2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";

interface Vote {
  id: string;
  status: string;
  user: { id: string; displayName: string; avatarUrl?: string };
}

interface Training {
  id: string;
  title: string;
  type: string;
  meetTime: string;
  date: string;
  endDate?: string;
  notes?: string;
  location?: string;
  votes: Vote[];
  createdBy: { id: string; displayName: string };
}

const TRAINING_TYPES = [
  { value: "RANKED", label: "Ranked" },
  { value: "CUSTOM", label: "Custom" },
  { value: "AIM_TRAINING", label: "Aim Training" },
  { value: "VOD_REVIEW", label: "VOD Review" },
  { value: "STRAT_PRACTICE", label: "Strat Übung" },
  { value: "OTHER", label: "Sonstiges" },
];

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export default function TrainingPage() {
  const { user } = useAuthStore();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", type: "RANKED", meetTime: "", date: "", endDate: "", notes: "", location: "" });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Training[]>("/api/trainings");
      if (res.data) setTrainings(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ title: "", type: "RANKED", meetTime: "", date: "", endDate: "", notes: "", location: "" });
    setShowModal(true);
  };

  const openEdit = (t: Training) => {
    setEditingId(t.id);
    setForm({
      title: t.title,
      type: t.type,
      meetTime: t.meetTime ? new Date(t.meetTime).toISOString().slice(0, 16) : "",
      date: t.date ? new Date(t.date).toISOString().slice(0, 16) : "",
      endDate: t.endDate ? new Date(t.endDate).toISOString().slice(0, 16) : "",
      notes: t.notes || "",
      location: t.location || "",
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const body = {
        title: form.title,
        type: form.type,
        meetTime: form.meetTime,
        date: form.date,
        endDate: form.endDate || null,
        notes: form.notes || null,
        location: form.location || null,
      };
      if (editingId) {
        await api.put(`/api/trainings/${editingId}`, body);
      } else {
        await api.post("/api/trainings", body);
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
    if (!confirm("Training wirklich löschen?")) return;
    try {
      await api.delete(`/api/trainings/${id}`);
      load();
    } catch {
      // ignore
    }
  };

  const handleVote = async (trainingId: string, status: string) => {
    try {
      await api.post(`/api/trainings/${trainingId}/vote`, { status });
      load();
    } catch {
      // ignore
    }
  };

  const getUserVote = (t: Training) => t.votes.find(v => v.user.id === user?.id)?.status;

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
          {trainings.map((t) => {
            const userVote = getUserVote(t);
            const available = t.votes.filter(v => v.status === "AVAILABLE").length;
            const maybe = t.votes.filter(v => v.status === "MAYBE").length;
            const unavailable = t.votes.filter(v => v.status === "UNAVAILABLE").length;

            return (
              <Card key={t.id} hover>
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-[var(--foreground)]">{t.title}</h3>
                    <Badge variant="info" className="mt-1">{TRAINING_TYPES.find(tt => tt.value === t.type)?.label || t.type}</Badge>
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

                <div className="mb-3 space-y-1 text-sm text-[var(--muted-foreground)]">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {formatDate(t.date)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Treffen: {formatTime(t.meetTime)} · Beginn: {formatTime(t.date)}
                    {t.endDate && <> · Ende: {formatTime(t.endDate)}</>}
                  </div>
                  {t.location && <div className="text-xs">📍 {t.location}</div>}
                </div>

                {t.notes && <p className="mb-3 text-sm text-[var(--muted-foreground)]">{t.notes}</p>}

                {/* Vote buttons */}
                <div className="flex gap-2 border-t border-[var(--border)] pt-3">
                  <button
                    onClick={() => handleVote(t.id, "AVAILABLE")}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium transition-all ${userVote === "AVAILABLE" ? "bg-green-500/20 text-green-400" : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-green-500/10 hover:text-green-400"}`}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Ja {available > 0 && `(${available})`}
                  </button>
                  <button
                    onClick={() => handleVote(t.id, "MAYBE")}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium transition-all ${userVote === "MAYBE" ? "bg-yellow-500/20 text-yellow-400" : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-yellow-500/10 hover:text-yellow-400"}`}
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    Vllt {maybe > 0 && `(${maybe})`}
                  </button>
                  <button
                    onClick={() => handleVote(t.id, "UNAVAILABLE")}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium transition-all ${userVote === "UNAVAILABLE" ? "bg-red-500/20 text-red-400" : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-400"}`}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Nein {unavailable > 0 && `(${unavailable})`}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? "Training bearbeiten" : "Neues Training"}>
        <div className="space-y-4">
          <Input label="Titel" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="z.B. Taktik Training" />
          <Select label="Typ" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={TRAINING_TYPES} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Treffzeit *" type="datetime-local" value={form.meetTime} onChange={(e) => setForm({ ...form, meetTime: e.target.value })} />
            <Input label="Beginn *" type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <Input label="Ende (optional)" type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          <Input label="Ort" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="z.B. Discord Channel" />
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
