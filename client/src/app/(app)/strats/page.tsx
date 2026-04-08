"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Map, Upload, Download, Trash2, Edit2, Filter, Clock, FileText, Star } from "lucide-react";
import { api } from "@/lib/api";
import { useT } from "@/i18n/provider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

interface Strat {
  id: string;
  title: string;
  map: string;
  side: "ATTACK" | "DEFENSE";
  type?: string;
  description?: string;
  content?: string;
  fileUrl?: string;
  version: number;
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: { displayName: string };
  versions?: { version: number; createdAt: string }[];
}

export default function StratsPage() {
  const t = useT("strats");
  const tc = useT("common");
  const { success, error } = useToast();
  const [strats, setStrats] = useState<Strat[]>([]);
  const [maps, setMaps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterMap, setFilterMap] = useState("");
  const [filterSide, setFilterSide] = useState("");
  const [form, setForm] = useState({ title: "", map: "", side: "ATTACK" as "ATTACK" | "DEFENSE", description: "", content: "" });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [versionModal, setVersionModal] = useState<Strat | null>(null);

  const loadMaps = useCallback(async () => {
    try {
      const res = await api.get<{ maps: string[] }>("/api/team/config");
      if (res.data?.maps) setMaps(res.data.maps);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadMaps(); }, [loadMaps]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterMap) params.set("map", filterMap);
      if (filterSide) params.set("side", filterSide);
      const q = params.toString();
      const res = await api.get<Strat[]>(`/api/strats${q ? `?${q}` : ""}`);
      if (res.data) setStrats(res.data);
    } catch {
      error(tc("loadError"));
    } finally {
      setLoading(false);
    }
  }, [filterMap, filterSide, error, tc]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ title: "", map: maps[0] || "", side: "ATTACK", description: "", content: "" });
    setUploadFile(null);
    setShowModal(true);
  };

  const openEdit = (s: Strat) => {
    setEditingId(s.id);
    setForm({ title: s.title, map: s.map, side: s.side, description: s.description || "", content: s.content || "" });
    setUploadFile(null);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (uploadFile) {
        const data: Record<string, string> = { title: form.title, map: form.map, side: form.side };
        if (form.description) data.description = form.description;
        if (editingId) {
          await api.upload(`/api/strats/${editingId}/file`, uploadFile, data);
        } else {
          await api.upload("/api/strats", uploadFile, data);
        }
      } else {
        if (editingId) {
          await api.put(`/api/strats/${editingId}`, form);
        } else {
          await api.post("/api/strats", form);
        }
      }
      if (editingId) {
        success(tc("saved"));
      } else {
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
      await api.delete(`/api/strats/${id}`);
      success(tc("deleted"));
      load();
    } catch {
      error(tc("deleteError"));
    }
  };

  const toggleFavorite = async (id: string) => {
    try {
      await api.post(`/api/strats/${id}/favorite`);
      load();
    } catch { error(tc("saveError")); }
  };

  const sideLabel = (side: string) => {
    if (side === "ATTACK") return t("attack");
    if (side === "DEFENSE") return t("defense");
    return side;
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

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-[var(--muted-foreground)]" />
          <span className="text-sm text-[var(--muted-foreground)]">Map:</span>
          <div className="flex flex-wrap gap-1">
            <button onClick={() => setFilterMap("")} className={`rounded-lg px-2 py-1 text-xs font-medium transition-all ${!filterMap ? "bg-[var(--primary)] text-white" : "bg-[var(--secondary)] text-[var(--muted-foreground)]"}`}>{tc("all")}</button>
            {maps.map((m) => (
              <button key={m} onClick={() => setFilterMap(m)} className={`rounded-lg px-2 py-1 text-xs font-medium transition-all ${filterMap === m ? "bg-[var(--primary)] text-white" : "bg-[var(--secondary)] text-[var(--muted-foreground)]"}`}>{m}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--muted-foreground)]">{t("side")}:</span>
          <div className="flex gap-1">
            {[{ v: "", l: tc("all") }, { v: "ATTACK", l: t("attack") }, { v: "DEFENSE", l: t("defense") }].map((o) => (
              <button key={o.v} onClick={() => setFilterSide(o.v)} className={`rounded-lg px-2 py-1 text-xs font-medium transition-all ${filterSide === o.v ? "bg-[var(--primary)] text-white" : "bg-[var(--secondary)] text-[var(--muted-foreground)]"}`}>{o.l}</button>
            ))}
          </div>
        </div>
      </div>

      {strats.length === 0 ? (
        <Card className="py-12 text-center">
          <Map className="mx-auto mb-4 h-12 w-12 text-[var(--muted-foreground)]" />
          <p className="text-[var(--muted-foreground)]">{t("empty")}</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {strats.map((s) => (
            <Card key={s.id} hover>
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-[var(--foreground)]">{s.title}</h3>
                  <div className="mt-1 flex gap-2">
                    <Badge variant="info">{s.map}</Badge>
                    <Badge variant={s.side === "ATTACK" ? "warning" : "info"}>{sideLabel(s.side)}</Badge>
                    <Badge variant="outline">v{s.version}</Badge>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => toggleFavorite(s.id)} className={`rounded p-1 transition-colors ${s.isFavorite ? "text-yellow-400" : "text-[var(--muted-foreground)] hover:text-yellow-400"}`}>
                    <Star className={`h-4 w-4 ${s.isFavorite ? "fill-current" : ""}`} />
                  </button>
                  <button onClick={() => openEdit(s)} className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {s.description && <p className="mb-3 text-sm text-[var(--muted-foreground)]">{s.description}</p>}
              <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                <span>{s.createdBy?.displayName}</span>
                <span>{formatDate(s.updatedAt)}</span>
              </div>
              <div className="mt-3 flex gap-2 border-t border-[var(--border)] pt-3">
                {s.fileUrl && (
                  <a href={s.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:text-[var(--foreground)]">
                    <Download className="h-3.5 w-3.5" /> {tc("download")}
                  </a>
                )}
                <button
                  onClick={() => setVersionModal(s)}
                  className="flex items-center gap-1 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:text-[var(--foreground)]"
                >
                  <Clock className="h-3.5 w-3.5" /> {t("versions")}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? t("editTitle") : t("createTitle")} size="lg">
        <div className="space-y-4">
          <Input label={t("form.title")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("form.titlePlaceholder")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label={t("form.map")} value={form.map} onChange={(e) => setForm({ ...form, map: e.target.value })} options={maps.map((m) => ({ value: m, label: m }))} />
            <Select label={t("form.side")} value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value as "ATTACK" | "DEFENSE" })} options={[{ value: "ATTACK", label: t("attack") }, { value: "DEFENSE", label: t("defense") }]} />
          </div>
          <Textarea label={t("form.description")} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Textarea label={t("form.content")} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="min-h-[120px]" placeholder={t("form.contentPlaceholder")} />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--foreground)]">{t("form.uploadFile")}</label>
            <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} className="w-full text-sm text-[var(--muted-foreground)] file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--primary)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-orange-600" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>{tc("cancel")}</Button>
            <Button onClick={handleSubmit} isLoading={submitting}>{editingId ? tc("save") : tc("create")}</Button>
          </div>
        </div>
      </Modal>

      {/* Version History Modal */}
      <Modal open={!!versionModal} onClose={() => setVersionModal(null)} title={`${t("versions")}: ${versionModal?.title}`}>
        <div className="space-y-2">
          {versionModal?.versions && versionModal.versions.length > 0 ? (
            versionModal.versions.map((v) => (
              <div key={v.version} className="flex items-center justify-between rounded-lg bg-[var(--secondary)] p-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[var(--primary)]" />
                  <span className="text-sm font-medium text-[var(--foreground)]">{tc("version")} {v.version}</span>
                </div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  {formatDate(v.createdAt)}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">{t("noVersions")}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
