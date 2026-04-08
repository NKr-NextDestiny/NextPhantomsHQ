"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, StickyNote, Trash2, Edit3, Lock, Globe } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

interface Note {
  id: string;
  title: string;
  content: string;
  isPrivate: boolean;
  createdBy: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
}

export default function NotesPage() {
  const { user } = useAuthStore();
  const { success, error } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [viewNote, setViewNote] = useState<Note | null>(null);
  const [form, setForm] = useState({ title: "", content: "", isPrivate: false });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Note[]>("/api/notes");
      if (res.data) setNotes(res.data);
    } catch {
      error("Fehler beim Laden");
    } finally { setLoading(false); }
  }, [error]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditNote(null);
    setForm({ title: "", content: "", isPrivate: false });
    setShowModal(true);
  };

  const openEdit = (note: Note) => {
    setEditNote(note);
    setForm({ title: note.title, content: note.content, isPrivate: note.isPrivate });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (editNote) {
        await api.put(`/api/notes/${editNote.id}`, form);
        success("Gespeichert");
      } else {
        await api.post("/api/notes", form);
        success("Notiz erstellt");
      }
      setShowModal(false);
      setEditNote(null);
      load();
    } catch {
      error("Fehler beim Speichern");
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Notiz wirklich löschen?")) return;
    try {
      await api.delete(`/api/notes/${id}`);
      success("Gelöscht");
      load();
    } catch {
      error("Fehler beim Löschen");
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
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Notizen</h1>
          <p className="text-[var(--muted-foreground)]">Persönliche und Team-Notizen</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Neue Notiz
        </Button>
      </div>

      {notes.length === 0 ? (
        <Card className="py-12 text-center">
          <StickyNote className="mx-auto mb-4 h-12 w-12 text-[var(--muted-foreground)]" />
          <p className="text-[var(--muted-foreground)]">Noch keine Notizen erstellt.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <Card key={note.id} hover className="cursor-pointer" onClick={() => setViewNote(note)}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-[var(--foreground)]">{note.title}</h3>
                  <div className="mt-1 flex items-center gap-2">
                    {note.isPrivate ? (
                      <Badge variant="outline"><Lock className="mr-1 h-3 w-3" />Privat</Badge>
                    ) : (
                      <Badge variant="success"><Globe className="mr-1 h-3 w-3" />Team</Badge>
                    )}
                  </div>
                </div>
                {(note.createdBy.id === user?.id || user?.isAdmin) && (
                  <div className="flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(note); }} className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--primary)]">
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(note.id); }} className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              <p className="mt-2 line-clamp-3 text-sm text-[var(--muted-foreground)]">{note.content}</p>
              <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                {note.createdBy.displayName} - {formatDate(note.updatedAt)}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* View note */}
      <Modal open={!!viewNote} onClose={() => setViewNote(null)} title={viewNote?.title || ""}>
        {viewNote && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {viewNote.isPrivate ? (
                <Badge variant="outline"><Lock className="mr-1 h-3 w-3" />Privat</Badge>
              ) : (
                <Badge variant="success"><Globe className="mr-1 h-3 w-3" />Team</Badge>
              )}
            </div>
            <div className="whitespace-pre-wrap text-sm text-[var(--foreground)]">{viewNote.content}</div>
            <p className="border-t border-[var(--border)] pt-3 text-xs text-[var(--muted-foreground)]">
              Von {viewNote.createdBy.displayName} - {formatDate(viewNote.updatedAt)}
            </p>
          </div>
        )}
      </Modal>

      {/* Create/Edit modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setEditNote(null); }} title={editNote ? "Notiz bearbeiten" : "Neue Notiz"}>
        <div className="space-y-4">
          <Input label="Titel" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Notiz-Titel" />
          <Textarea label="Inhalt" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={8} />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPrivate"
              checked={form.isPrivate}
              onChange={(e) => setForm({ ...form, isPrivate: e.target.checked })}
              className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)]"
            />
            <label htmlFor="isPrivate" className="text-sm text-[var(--foreground)]">Privat (nur für mich sichtbar)</label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => { setShowModal(false); setEditNote(null); }}>Abbrechen</Button>
            <Button onClick={handleSubmit} isLoading={submitting}>{editNote ? "Speichern" : "Erstellen"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
