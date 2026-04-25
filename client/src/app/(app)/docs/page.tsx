"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, BookOpen, Trash2, Edit3, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useT } from "@/i18n/provider";
import { repairMojibake } from "@/i18n";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

interface WikiPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  createdBy: { id: string; displayName: string };
  updatedBy?: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
}

export default function WikiPageList() {
  const { user } = useAuthStore();
  const { success, error } = useToast();
  const t = useT("docs");
  const tc = useT("common");
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editPage, setEditPage] = useState<WikiPage | null>(null);
  const [viewPage, setViewPage] = useState<WikiPage | null>(null);
  const [form, setForm] = useState({ title: "", slug: "", content: "" });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<WikiPage[]>("/api/wiki");
      if (res.data) setPages(res.data);
    } catch {
      error(tc("loadError"));
    } finally { setLoading(false); }
  }, [error, tc]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditPage(null);
    setForm({ title: "", slug: "", content: "" });
    setShowModal(true);
  };

  const openEdit = async (slug: string) => {
    try {
      const res = await api.get<WikiPage>(`/api/wiki/${slug}`);
      if (res.data) {
        setEditPage(res.data);
        setForm({ title: res.data.title, slug: res.data.slug, content: res.data.content });
        setShowModal(true);
      }
    } catch {
      error(tc("loadError"));
    }
  };

  const openView = async (slug: string) => {
    try {
      const res = await api.get<WikiPage>(`/api/wiki/${slug}`);
      if (res.data) setViewPage(res.data);
    } catch {
      error(tc("loadError"));
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (editPage) {
        await api.put(`/api/wiki/${editPage.slug}`, form);
        success(tc("saved"));
      } else {
        await api.post("/api/wiki", form);
        success(t("created"));
      }
      setShowModal(false);
      setEditPage(null);
      load();
    } catch {
      error(tc("saveError"));
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (slug: string) => {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await api.delete(`/api/wiki/${slug}`);
      success(tc("deleted"));
      load();
    } catch {
      error(tc("deleteError"));
    }
  };

  const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

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

      {pages.length === 0 ? (
        <Card className="py-12 text-center">
          <BookOpen className="mx-auto mb-4 h-12 w-12 text-[var(--muted-foreground)]" />
          <p className="text-[var(--muted-foreground)]">{t("empty")}</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pages.map((page) => (
            <Card key={page.id} hover className="cursor-pointer" onClick={() => openView(page.slug)}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-[var(--foreground)]">{repairMojibake(page.title)}</h3>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">/{page.slug}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(page.slug); }} className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--primary)]">
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(page.slug); }} className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                <Clock className="h-3.5 w-3.5" /> {formatDate(page.updatedAt)}
                <span className="ml-2">{tc("by")} {page.createdBy.displayName}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* View page */}
      <Modal open={!!viewPage} onClose={() => setViewPage(null)} title={repairMojibake(viewPage?.title || "")}>
        {viewPage && (
          <div className="space-y-4">
            <div className="whitespace-pre-wrap text-sm text-[var(--foreground)]">{repairMojibake(viewPage.content)}</div>
            <div className="border-t border-[var(--border)] pt-3 text-xs text-[var(--muted-foreground)]">
              {t("createdBy", { name: viewPage.createdBy.displayName, date: formatDate(viewPage.createdAt) })}
              {viewPage.updatedBy && <> — {t("editedBy", { name: viewPage.updatedBy.displayName })}</>}
            </div>
          </div>
        )}
      </Modal>

      {/* Create/Edit modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setEditPage(null); }} title={editPage ? t("editTitle") : t("createTitle")}>
        <div className="space-y-4">
          <Input
            label={t("form.title")}
            value={form.title}
            onChange={(e) => {
              const title = e.target.value;
              setForm({ ...form, title, slug: editPage ? form.slug : slugify(title) });
            }}
            placeholder={t("form.titlePlaceholder")}
          />
          <Input label={t("form.slug")} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder={t("form.slugPlaceholder")} />
          <Textarea label={t("form.content")} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={10} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => { setShowModal(false); setEditPage(null); }}>{tc("cancel")}</Button>
            <Button onClick={handleSubmit} isLoading={submitting}>{editPage ? tc("save") : tc("create")}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
