"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Megaphone, Pin, Trash2, Edit2, Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: "low" | "normal" | "high" | "urgent";
  isPinned: boolean;
  isDismissed: boolean;
  author: { displayName: string; avatarUrl?: string };
  createdAt: string;
  updatedAt: string;
}

export default function AnnouncementsPage() {
  const { user } = useAuthStore();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", content: "", priority: "normal" });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Announcement[]>("/api/announcements");
      if (res.data) setAnnouncements(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ title: "", content: "", priority: "normal" });
    setShowModal(true);
  };

  const openEdit = (a: Announcement) => {
    setEditingId(a.id);
    setForm({ title: a.title, content: a.content, priority: a.priority });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (editingId) {
        await api.put(`/api/announcements/${editingId}`, form);
      } else {
        await api.post("/api/announcements", form);
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
    if (!confirm("Ankuendigung wirklich loeschen?")) return;
    try {
      await api.delete(`/api/announcements/${id}`);
      load();
    } catch {
      // ignore
    }
  };

  const handlePin = async (id: string) => {
    try {
      await api.patch(`/api/announcements/${id}/pin`);
      load();
    } catch {
      // ignore
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await api.patch(`/api/announcements/${id}/dismiss`);
      load();
    } catch {
      // ignore
    }
  };

  const priorityColor = (p: string) => {
    switch (p) {
      case "urgent": return "destructive";
      case "high": return "warning";
      case "normal": return "info";
      default: return "outline";
    }
  };

  const priorityLabel = (p: string) => {
    switch (p) {
      case "urgent": return "Dringend";
      case "high": return "Hoch";
      case "normal": return "Normal";
      default: return "Niedrig";
    }
  };

  // Pinned first, then by date
  const sorted = [...announcements].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

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
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Ankuendigungen</h1>
          <p className="text-[var(--muted-foreground)]">Team-Ankuendigungen und Neuigkeiten</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Neue Ankuendigung
        </Button>
      </div>

      {sorted.length === 0 ? (
        <Card className="py-12 text-center">
          <Megaphone className="mx-auto mb-4 h-12 w-12 text-[var(--muted-foreground)]" />
          <p className="text-[var(--muted-foreground)]">Noch keine Ankuendigungen.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {sorted.map((a) => (
            <Card
              key={a.id}
              hover
              className={`${a.isDismissed ? "opacity-60" : ""} ${a.isPinned ? "border-[var(--primary)]/30" : ""} ${a.priority === "urgent" ? "border-red-500/30" : ""}`}
            >
              <div className="flex items-start gap-4">
                {a.author.avatarUrl ? (
                  <img src={a.author.avatarUrl} alt="" className="h-10 w-10 rounded-full" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)]/20 text-sm font-bold text-[var(--primary)]">
                    {a.author.displayName.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[var(--foreground)]">{a.title}</h3>
                    {a.isPinned && <Pin className="h-4 w-4 text-[var(--primary)]" />}
                    <Badge variant={priorityColor(a.priority) as any}>{priorityLabel(a.priority)}</Badge>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--muted-foreground)]">{a.content}</p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
                    <span>{a.author.displayName}</span>
                    <span>{formatDate(a.createdAt)}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handlePin(a.id)}
                    className={`rounded p-1.5 transition-colors ${a.isPinned ? "text-[var(--primary)]" : "text-[var(--muted-foreground)] hover:text-[var(--primary)]"}`}
                    title={a.isPinned ? "Loesung aufheben" : "Anpinnen"}
                  >
                    <Pin className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDismiss(a.id)}
                    className="rounded p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    title={a.isDismissed ? "Wieder anzeigen" : "Ausblenden"}
                  >
                    {a.isDismissed ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button onClick={() => openEdit(a)} className="rounded p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(a.id)} className="rounded p-1.5 text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? "Ankuendigung bearbeiten" : "Neue Ankuendigung"}>
        <div className="space-y-4">
          <Input label="Titel" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Betreff" />
          <Select
            label="Prioritaet"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            options={[
              { value: "low", label: "Niedrig" },
              { value: "normal", label: "Normal" },
              { value: "high", label: "Hoch" },
              { value: "urgent", label: "Dringend" },
            ]}
          />
          <Textarea label="Inhalt" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="min-h-[120px]" placeholder="Ankuendigung schreiben..." />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>Abbrechen</Button>
            <Button onClick={handleSubmit} isLoading={submitting}>{editingId ? "Speichern" : "Erstellen"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
