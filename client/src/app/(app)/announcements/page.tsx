"use client";

import { useCallback, useEffect, useState } from "react";
import { Edit2, Eye, EyeOff, Image as ImageIcon, Megaphone, Pin, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useT } from "@/i18n/provider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

interface Announcement {
  id: string;
  title: string;
  content: string;
  imageUrl?: string | null;
  pinned: boolean;
  dismissed: boolean;
  createdBy: { displayName: string; avatarUrl?: string | null };
  createdAt: string;
  updatedAt: string;
}

export default function AnnouncementsPage() {
  const { user } = useAuthStore();
  const { success, error } = useToast();
  const t = useT("announcements");
  const tc = useT("common");

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", content: "", pinned: false, removeImage: false });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Announcement[]>("/api/announcements");
      if (res.data) setAnnouncements(res.data);
    } catch {
      error(tc("loadError"));
    } finally {
      setLoading(false);
    }
  }, [error, tc]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ title: "", content: "", pinned: false, removeImage: false });
    setImageFile(null);
    setShowModal(true);
  };

  const openEdit = (announcement: Announcement) => {
    setEditingId(announcement.id);
    setForm({
      title: announcement.title,
      content: announcement.content,
      pinned: announcement.pinned,
      removeImage: false,
    });
    setImageFile(null);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append("title", form.title);
      payload.append("content", form.content);
      payload.append("pinned", String(form.pinned));
      payload.append("removeImage", String(form.removeImage));
      if (imageFile) payload.append("image", imageFile);

      if (editingId) {
        await api.put(`/api/announcements/${editingId}`, payload);
        success(tc("saved"));
      } else {
        await api.post("/api/announcements", payload);
        success(t("created"));
      }

      setShowModal(false);
      load();
    } catch {
      error(tc("saveError"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await api.delete(`/api/announcements/${id}`);
      success(tc("deleted"));
      load();
    } catch {
      error(tc("deleteError"));
    }
  };

  const handlePin = async (id: string) => {
    try {
      await api.post(`/api/announcements/${id}/pin`);
      load();
    } catch {
      error(tc("saveError"));
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await api.post(`/api/announcements/${id}/dismiss`);
      load();
    } catch {
      error(tc("saveError"));
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
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{t("title")}</h1>
          <p className="text-[var(--muted-foreground)]">{t("subtitle")}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> {t("new")}
        </Button>
      </div>

      {announcements.length === 0 ? (
        <Card className="py-12 text-center">
          <Megaphone className="mx-auto mb-4 h-12 w-12 text-[var(--muted-foreground)]" />
          <p className="text-[var(--muted-foreground)]">{t("empty")}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((announcement) => (
            <Card
              key={announcement.id}
              hover
              className={`${announcement.dismissed ? "opacity-60" : ""} ${announcement.pinned ? "border-[var(--primary)]/40" : ""}`}
            >
              <div className="flex gap-4">
                {announcement.createdBy.avatarUrl ? (
                  <img src={announcement.createdBy.avatarUrl} alt="" className="h-10 w-10 rounded-full" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)]/20 font-bold text-[var(--primary)]">
                    {announcement.createdBy.displayName.charAt(0)}
                  </div>
                )}

                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-[var(--foreground)]">{announcement.title}</h2>
                    {announcement.pinned && <Pin className="h-4 w-4 text-[var(--primary)]" />}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-[var(--muted-foreground)]">{announcement.content}</p>
                  {announcement.imageUrl && (
                    <img
                      src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}${announcement.imageUrl}`}
                      alt=""
                      className="max-h-80 w-full rounded-lg border border-[var(--border)] object-cover"
                    />
                  )}
                  <div className="flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
                    <span>{announcement.createdBy.displayName}</span>
                    <span>{formatDate(announcement.createdAt)}</span>
                  </div>
                </div>

                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => handlePin(announcement.id)}
                    className={`rounded p-1.5 transition-colors ${announcement.pinned ? "text-[var(--primary)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
                    title={announcement.pinned ? t("unpin") : t("pin")}
                  >
                    <Pin className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDismiss(announcement.id)}
                    className="rounded p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    title={announcement.dismissed ? t("show") : t("hide")}
                  >
                    {announcement.dismissed ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  {user && (
                    <>
                      <button onClick={() => openEdit(announcement)} className="rounded p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(announcement.id)} className="rounded p-1.5 text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? t("editTitle") : t("createTitle")}>
        <div className="space-y-4">
          <Input label={t("form.title")} value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
          <Textarea label={t("form.content")} value={form.content} onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))} className="min-h-[140px]" />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--foreground)]">Bild (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-[var(--muted-foreground)] file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--primary)] file:px-3 file:py-2 file:text-white"
            />
            {editingId && (
              <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                <input type="checkbox" checked={form.removeImage} onChange={(e) => setForm((prev) => ({ ...prev, removeImage: e.target.checked }))} />
                Vorhandenes Bild entfernen
              </label>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
            <input type="checkbox" checked={form.pinned} onChange={(e) => setForm((prev) => ({ ...prev, pinned: e.target.checked }))} />
            Angepinnt
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>{tc("cancel")}</Button>
            <Button onClick={handleSubmit} isLoading={submitting}>
              <ImageIcon className="h-4 w-4" /> {editingId ? tc("save") : tc("create")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
