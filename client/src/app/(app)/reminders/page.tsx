"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Bell, Trash2, Edit3, CheckCircle2, Circle, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";

interface Reminder {
  id: string;
  title: string;
  content: string | null;
  deadline: string | null;
  done: boolean;
  createdBy: { id: string; displayName: string };
  createdAt: string;
}

export default function RemindersPage() {
  const { user } = useAuthStore();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editReminder, setEditReminder] = useState<Reminder | null>(null);
  const [form, setForm] = useState({ title: "", content: "", deadline: "" });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Reminder[]>("/api/reminders");
      if (res.data) setReminders(res.data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditReminder(null);
    setForm({ title: "", content: "", deadline: "" });
    setShowModal(true);
  };

  const openEdit = (r: Reminder) => {
    setEditReminder(r);
    setForm({
      title: r.title,
      content: r.content || "",
      deadline: r.deadline ? new Date(r.deadline).toISOString().slice(0, 16) : "",
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const body = {
        title: form.title,
        content: form.content || undefined,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined,
      };
      if (editReminder) {
        await api.put(`/api/reminders/${editReminder.id}`, body);
      } else {
        await api.post("/api/reminders", body);
      }
      setShowModal(false);
      setEditReminder(null);
      load();
    } catch {} finally { setSubmitting(false); }
  };

  const handleToggle = async (id: string) => {
    try {
      await api.patch(`/api/reminders/${id}/toggle`);
      load();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Erinnerung wirklich loeschen?")) return;
    try {
      await api.delete(`/api/reminders/${id}`);
      load();
    } catch {}
  };

  const isOverdue = (deadline: string | null) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
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
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Erinnerungen</h1>
          <p className="text-[var(--muted-foreground)]">Team-Erinnerungen und Deadlines</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Neue Erinnerung
        </Button>
      </div>

      {reminders.length === 0 ? (
        <Card className="py-12 text-center">
          <Bell className="mx-auto mb-4 h-12 w-12 text-[var(--muted-foreground)]" />
          <p className="text-[var(--muted-foreground)]">Keine Erinnerungen vorhanden.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {reminders.map((r) => (
            <Card key={r.id} className={`flex items-start gap-4 ${r.done ? "opacity-60" : ""}`}>
              <button onClick={() => handleToggle(r.id)} className="mt-1 shrink-0">
                {r.done ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <Circle className="h-5 w-5 text-[var(--muted-foreground)]" />
                )}
              </button>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className={`font-semibold text-[var(--foreground)] ${r.done ? "line-through" : ""}`}>{r.title}</h3>
                    {r.content && <p className="mt-1 text-sm text-[var(--muted-foreground)]">{r.content}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(r)} className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--primary)]">
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(r.id)} className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                  {r.deadline && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span className={!r.done && isOverdue(r.deadline) ? "font-bold text-[var(--destructive)]" : ""}>
                        {formatDate(r.deadline)}
                      </span>
                      {!r.done && isOverdue(r.deadline) && <Badge variant="destructive">Ueberfaellig</Badge>}
                    </div>
                  )}
                  <span>von {r.createdBy.displayName}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => { setShowModal(false); setEditReminder(null); }} title={editReminder ? "Erinnerung bearbeiten" : "Neue Erinnerung"}>
        <div className="space-y-4">
          <Input label="Titel" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Was soll erinnert werden?" />
          <Textarea label="Details (optional)" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          <Input label="Deadline (optional)" type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => { setShowModal(false); setEditReminder(null); }}>Abbrechen</Button>
            <Button onClick={handleSubmit} isLoading={submitting}>{editReminder ? "Speichern" : "Erstellen"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
