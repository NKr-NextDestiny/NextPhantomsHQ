"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Eye, Trash2, Edit2, AlertTriangle, Shield, Skull, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { api } from "@/lib/api";
import { useT } from "@/i18n/provider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

interface ScoutingNote {
  id: string;
  content: string;
  map?: string;
  category?: string;
  createdAt: string;
  createdBy: { displayName: string; avatarUrl?: string };
}

interface ScoutingEntryDetail {
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
  scoutingNotes: ScoutingNote[];
}

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
  { value: "LOW", color: "success", icon: Shield },
  { value: "MEDIUM", color: "warning", icon: AlertTriangle },
  { value: "HIGH", color: "destructive", icon: AlertTriangle },
  { value: "CRITICAL", color: "destructive", icon: Skull },
] as const;

export default function ScoutingPage() {
  const t = useT("scouting");
  const tc = useT("common");
  const { success, error } = useToast();
  const [entries, setEntries] = useState<ScoutingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<ScoutingEntryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [maps, setMaps] = useState<string[]>([]);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteForm, setNoteForm] = useState({ content: "", map: "", category: "" });
  const [noteSubmitting, setNoteSubmitting] = useState(false);
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
      error(tc("loadError"));
    } finally {
      setLoading(false);
    }
  }, [error, tc]);

  useEffect(() => { load(); }, [load]);

  // Load maps from game config
  useEffect(() => {
    api.get<{ gameConfig?: { maps?: string[] } }>("/api/team/config").then((res) => {
      if (res.data?.gameConfig?.maps) setMaps(res.data.gameConfig.maps);
    }).catch(() => {});
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setExpandedDetail(null);
    try {
      const res = await api.get<ScoutingEntryDetail>(`/api/scouting/opponents/${id}`);
      if (res.data) setExpandedDetail(res.data);
    } catch {
      error(t("detailLoadError"));
    } finally {
      setDetailLoading(false);
    }
  }, [error, t]);

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedDetail(null);
      setShowNoteForm(false);
    } else {
      setExpandedId(id);
      setShowNoteForm(false);
      setNoteForm({ content: "", map: "", category: "" });
      loadDetail(id);
    }
  };

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
        success(t("entrySaved"));
      } else {
        await api.post("/api/scouting/opponents", form);
        success(t("entryCreated"));
      }
      setShowModal(false);
      load();
    } catch {
      error(t("saveError"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await api.delete(`/api/scouting/opponents/${id}`);
      success(t("entryDeleted"));
      if (expandedId === id) {
        setExpandedId(null);
        setExpandedDetail(null);
      }
      load();
    } catch {
      error(tc("deleteError"));
    }
  };

  const handleAddNote = async () => {
    if (!expandedId || !noteForm.content.trim()) return;
    setNoteSubmitting(true);
    try {
      await api.post(`/api/scouting/opponents/${expandedId}/notes`, {
        content: noteForm.content.trim(),
        map: noteForm.map || undefined,
        category: noteForm.category || undefined,
      });
      success(t("noteAdded"));
      setNoteForm({ content: "", map: "", category: "" });
      setShowNoteForm(false);
      loadDetail(expandedId);
      load();
    } catch {
      error(t("noteAddError"));
    } finally {
      setNoteSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!expandedId) return;
    if (!confirm(t("confirmDeleteNote"))) return;
    try {
      await api.delete(`/api/scouting/notes/${noteId}`);
      success(t("noteDeleted"));
      loadDetail(expandedId);
      load();
    } catch {
      error(t("noteDeleteError"));
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
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{t("title")}</h1>
          <p className="text-[var(--muted-foreground)]">{t("subtitle")}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> {t("new")}
        </Button>
      </div>

      {entries.length === 0 ? (
        <Card className="py-12 text-center">
          <Eye className="mx-auto mb-4 h-12 w-12 text-[var(--muted-foreground)]" />
          <p className="text-[var(--muted-foreground)]">{t("empty")}</p>
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
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${threat.value === "LOW" ? "bg-green-500/20" : threat.value === "MEDIUM" ? "bg-yellow-500/20" : "bg-red-500/20"}`}>
                    <ThreatIcon className={`h-5 w-5 ${threat.value === "LOW" ? "text-green-400" : threat.value === "MEDIUM" ? "text-yellow-400" : "text-red-400"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[var(--foreground)]">{e.name}</h3>
                      {e.teamTag && <Badge variant="outline">{e.teamTag}</Badge>}
                      <Badge variant={threat.color as "success" | "warning" | "destructive" | "outline"}>{t(`threatLevels.${threat.value}`)}</Badge>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {tc("updated")}: {formatDate(e.updatedAt)}
                      {e._count && ` · ${e._count.scoutingNotes} ${t("notes")}`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => toggleExpand(e.id)} className="rounded p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
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
                  <div className="mt-4 space-y-4 border-t border-[var(--border)] pt-4">
                    {/* General info */}
                    {(e.playstyle || e.notes || e.strengths || e.weaknesses) && (
                      <div className="space-y-3">
                        {e.playstyle && (
                          <div>
                            <h4 className="mb-1 text-sm font-medium text-[var(--foreground)]">{t("playstyle")}</h4>
                            <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-wrap">{e.playstyle}</p>
                          </div>
                        )}
                        {e.notes && (
                          <div>
                            <h4 className="mb-1 text-sm font-medium text-[var(--foreground)]">{t("notes")}</h4>
                            <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-wrap">{e.notes}</p>
                          </div>
                        )}
                        <div className="grid gap-4 sm:grid-cols-2">
                          {e.strengths && (
                            <div>
                              <h4 className="mb-1 text-sm font-medium text-green-400">{t("strengths")}</h4>
                              <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-wrap">{e.strengths}</p>
                            </div>
                          )}
                          {e.weaknesses && (
                            <div>
                              <h4 className="mb-1 text-sm font-medium text-red-400">{t("weaknesses")}</h4>
                              <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-wrap">{e.weaknesses}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Scouting Notes */}
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="text-sm font-medium text-[var(--foreground)] flex items-center gap-1.5">
                          <FileText className="h-4 w-4" /> {t("notesLabel")}
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowNoteForm(!showNoteForm);
                            setNoteForm({ content: "", map: "", category: "" });
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" /> {t("addNote")}
                        </Button>
                      </div>

                      {/* Add note form */}
                      {showNoteForm && (
                        <div className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-4 space-y-3">
                          <Textarea
                            label={t("form.noteContent")}
                            value={noteForm.content}
                            onChange={(ev) => setNoteForm({ ...noteForm, content: ev.target.value })}
                            rows={3}
                          />
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Select
                              label={t("form.noteMap")}
                              value={noteForm.map}
                              onChange={(ev) => setNoteForm({ ...noteForm, map: ev.target.value })}
                              options={[
                                { value: "", label: t("form.noMap") },
                                ...maps.map((m) => ({ value: m, label: m })),
                              ]}
                            />
                            <Input
                              label={t("form.noteCategory")}
                              value={noteForm.category}
                              onChange={(ev) => setNoteForm({ ...noteForm, category: ev.target.value })}
                              placeholder={t("form.noteCategoryPlaceholder")}
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setShowNoteForm(false); setNoteForm({ content: "", map: "", category: "" }); }}
                            >
                              {tc("cancel")}
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleAddNote}
                              isLoading={noteSubmitting}
                              disabled={!noteForm.content.trim()}
                            >
                              {tc("save")}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Notes list */}
                      {detailLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" />
                        </div>
                      ) : expandedDetail?.scoutingNotes?.length === 0 ? (
                        <p className="text-sm text-[var(--muted-foreground)] py-2">{t("noNotes")}</p>
                      ) : (
                        <div className="space-y-2">
                          {expandedDetail?.scoutingNotes?.map((note) => (
                            <div key={note.id} className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-3">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap flex-1">{note.content}</p>
                                <button
                                  onClick={() => handleDeleteNote(note.id)}
                                  className="shrink-0 rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {note.map && <Badge variant="outline">{note.map}</Badge>}
                                {note.category && <Badge variant="info">{note.category}</Badge>}
                                <span className="text-xs text-[var(--muted-foreground)]">
                                  {note.createdBy.displayName} · {formatDate(note.createdAt)}
                                </span>
                              </div>
                            </div>
                          ))}
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

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? t("editTitle") : t("createTitle")} size="lg">
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t("form.opponent")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label={t("form.teamTag")} value={form.teamTag} onChange={(e) => setForm({ ...form, teamTag: e.target.value })} />
          </div>
          <Select
            label={t("form.threatLevel")}
            value={form.threatLevel}
            onChange={(e) => setForm({ ...form, threatLevel: e.target.value as ScoutingEntry["threatLevel"] })}
            options={THREAT_LEVELS.map((tl) => ({ value: tl.value, label: t(`threatLevels.${tl.value}`) }))}
          />
          <Textarea label={t("form.playstyle")} value={form.playstyle} onChange={(e) => setForm({ ...form, playstyle: e.target.value })} />
          <Textarea label={t("form.notes")} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Textarea label={t("form.strengths")} value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} />
            <Textarea label={t("form.weaknesses")} value={form.weaknesses} onChange={(e) => setForm({ ...form, weaknesses: e.target.value })} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>{tc("cancel")}</Button>
            <Button onClick={handleSubmit} isLoading={submitting}>{editingId ? tc("save") : tc("create")}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
