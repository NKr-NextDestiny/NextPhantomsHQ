"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Plus,
  Dumbbell,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  HelpCircle,
  Trash2,
  Edit2,
  BookTemplate,
  PlayCircle,
  Repeat,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/provider";

interface Vote {
  id: string;
  status: string;
  comment?: string | null;
  user: { id: string; displayName: string; avatarUrl?: string };
}

interface Training {
  id: string;
  title: string;
  type: string;
  meetTime: string;
  date: string;
  endDate?: string | null;
  recurrence?: string;
  attendanceOpenHoursBefore?: number;
  attendanceCloseHoursBefore?: number;
  attendanceOpensAt?: string | null;
  attendanceClosesAt?: string | null;
  attendanceActivatedAt?: string | null;
  notes?: string;
  location?: string;
  votes: Vote[];
  createdBy: { id: string; displayName: string };
}

interface TrainingTemplate {
  id: string;
  title: string;
  type: string;
  notes?: string;
  createdBy: { displayName: string };
}

interface TeamDefaults {
  defaultAttendanceOpenHoursBefore?: number;
  defaultAttendanceCloseHoursBefore?: number;
}

type Recurrence = "NONE" | "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function recurrenceLabel(recurrence?: string) {
  switch (recurrence) {
    case "DAILY":
      return "Täglich";
    case "WEEKLY":
      return "Wöchentlich";
    case "BIWEEKLY":
      return "Alle 2 Wochen";
    case "MONTHLY":
      return "Monatlich";
    default:
      return "Einmalig";
  }
}

function attendanceState(training: Training) {
  const now = Date.now();
  const opensAt = training.attendanceOpensAt ? new Date(training.attendanceOpensAt).getTime() : null;
  const closesAt = training.attendanceClosesAt ? new Date(training.attendanceClosesAt).getTime() : null;
  if (opensAt && now < opensAt) return "scheduled";
  if (closesAt && now > closesAt) return "closed";
  return "open";
}

export default function TrainingPage() {
  const { user } = useAuthStore();
  const { success, error } = useToast();
  const t = useT("training");
  const tc = useT("common");

  const [trainings, setTrainings] = useState<Training[]>([]);
  const [templates, setTemplates] = useState<TrainingTemplate[]>([]);
  const [teamDefaults, setTeamDefaults] = useState<TeamDefaults>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [voteReasons, setVoteReasons] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    title: "",
    type: "RANKED",
    meetTime: "",
    date: "",
    endDate: "",
    notes: "",
    location: "",
    recurrence: "NONE" as Recurrence,
    attendanceOpenHoursBefore: "72",
    attendanceCloseHoursBefore: "2",
    activateAttendanceNow: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const TRAINING_TYPES = useMemo(() => [
    { value: "RANKED", label: t("types.RANKED") },
    { value: "CUSTOM", label: t("types.CUSTOM") },
    { value: "AIM_TRAINING", label: t("types.AIM_TRAINING") },
    { value: "VOD_REVIEW", label: t("types.VOD_REVIEW") },
    { value: "STRAT_PRACTICE", label: t("types.STRAT_PRACTICE") },
    { value: "OTHER", label: t("types.OTHER") },
  ], [t]);

  const load = useCallback(async () => {
    try {
      const [trainingsRes, templatesRes, teamRes] = await Promise.allSettled([
        api.get<Training[]>("/api/trainings"),
        api.get<TrainingTemplate[]>("/api/training-templates"),
        api.get<TeamDefaults>("/api/team"),
      ]);
      if (trainingsRes.status === "fulfilled" && trainingsRes.value.data) setTrainings(trainingsRes.value.data);
      else if (trainingsRes.status === "rejected") error(tc("loadError"));
      if (templatesRes.status === "fulfilled" && templatesRes.value.data) setTemplates(templatesRes.value.data);
      if (teamRes.status === "fulfilled" && teamRes.value.data) {
        const defaults = teamRes.value.data;
        setTeamDefaults(defaults);
      }
    } catch {
      error(tc("loadError"));
    } finally {
      setLoading(false);
    }
  }, [error, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!editingId) {
      setForm((current) => ({
        ...current,
        attendanceOpenHoursBefore: String(teamDefaults.defaultAttendanceOpenHoursBefore ?? 72),
        attendanceCloseHoursBefore: String(teamDefaults.defaultAttendanceCloseHoursBefore ?? 2),
      }));
    }
  }, [teamDefaults, editingId]);

  const openCreate = () => {
    setEditingId(null);
    setSelectedTemplateId("");
    setForm({
      title: "",
      type: "RANKED",
      meetTime: "",
      date: "",
      endDate: "",
      notes: "",
      location: "",
      recurrence: "NONE",
      attendanceOpenHoursBefore: String(teamDefaults.defaultAttendanceOpenHoursBefore ?? 72),
      attendanceCloseHoursBefore: String(teamDefaults.defaultAttendanceCloseHoursBefore ?? 2),
      activateAttendanceNow: false,
    });
    setShowModal(true);
  };

  const openEdit = (tr: Training) => {
    setEditingId(tr.id);
    setSelectedTemplateId("");
    setForm({
      title: tr.title,
      type: tr.type,
      meetTime: tr.meetTime ? new Date(tr.meetTime).toISOString().slice(0, 16) : "",
      date: tr.date ? new Date(tr.date).toISOString().slice(0, 16) : "",
      endDate: tr.endDate ? new Date(tr.endDate).toISOString().slice(0, 16) : "",
      notes: tr.notes || "",
      location: tr.location || "",
      recurrence: (tr.recurrence as Recurrence) || "NONE",
      attendanceOpenHoursBefore: String(tr.attendanceOpenHoursBefore ?? teamDefaults.defaultAttendanceOpenHoursBefore ?? 72),
      attendanceCloseHoursBefore: String(tr.attendanceCloseHoursBefore ?? teamDefaults.defaultAttendanceCloseHoursBefore ?? 2),
      activateAttendanceNow: false,
    });
    setShowModal(true);
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const tpl = templates.find((tp) => tp.id === templateId);
    if (tpl) {
      setForm((prev) => ({
        ...prev,
        title: tpl.title,
        type: tpl.type,
        notes: tpl.notes || "",
      }));
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!form.title) {
      error(t("titleRequired"));
      return;
    }
    setSavingTemplate(true);
    try {
      await api.post("/api/training-templates", {
        title: form.title,
        type: form.type,
        notes: form.notes || null,
      });
      const res = await api.get<TrainingTemplate[]>("/api/training-templates");
      if (res.data) setTemplates(res.data);
      success(t("templateSaved"));
    } catch {
      error(t("templateSaveError"));
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm(t("confirmDeleteTemplate") || "Vorlage löschen?")) return;
    try {
      await api.delete(`/api/training-templates/${id}`);
      success(tc("deleted"));
      const res = await api.get<TrainingTemplate[]>("/api/training-templates");
      if (res.data) setTemplates(res.data);
    } catch {
      error(tc("deleteError"));
    }
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
        recurrence: form.recurrence,
        attendanceOpenHoursBefore: Number.parseInt(form.attendanceOpenHoursBefore || "72", 10),
        attendanceCloseHoursBefore: Number.parseInt(form.attendanceCloseHoursBefore || "2", 10),
        activateAttendanceNow: form.activateAttendanceNow,
      };
      if (editingId) {
        await api.put(`/api/trainings/${editingId}`, body);
        success(tc("saved"));
      } else {
        const response = await api.post<Training>("/api/trainings", body);
        const createdCount = (response as { createdCount?: number }).createdCount ?? 1;
        success(createdCount > 1 ? `${t("created")} (${createdCount} Termine)` : t("created"));
      }
      setShowModal(false);
      void load();
    } catch {
      error(tc("saveError"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await api.delete(`/api/trainings/${id}`);
      success(tc("deleted"));
      void load();
    } catch {
      error(tc("deleteError"));
    }
  };

  const handleVote = async (trainingId: string, status: string) => {
    const currentVote = trainings.find((tr) => tr.id === trainingId)?.votes.find((v) => v.user.id === user?.id)?.status;
    const comment = voteReasons[trainingId] || null;
    try {
      if (currentVote === status && !comment) {
        await api.delete(`/api/trainings/${trainingId}/vote`);
        success(t("voteRetracted") || "Stimme zurückgezogen");
      } else {
        await api.post(`/api/trainings/${trainingId}/vote`, { status, comment });
        success(t("voteSaved"));
      }
      void load();
    } catch {
      error(tc("saveError"));
    }
  };

  const activateAttendance = async (trainingId: string) => {
    setActivatingId(trainingId);
    try {
      await api.post(`/api/trainings/${trainingId}/activate-attendance`);
      success("Abstimmung wurde sofort geöffnet und verschickt.");
      void load();
    } catch {
      error("Abstimmung konnte nicht aktiviert werden.");
    } finally {
      setActivatingId(null);
    }
  };

  const getUserVote = (tr: Training) => tr.votes.find((v) => v.user.id === user?.id);

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
        <div className="flex gap-2">
          {templates.length > 0 && (
            <Button variant="outline" onClick={() => setShowTemplateManager(true)}>
              <BookTemplate className="h-4 w-4" /> {t("templates") || "Vorlagen"}
            </Button>
          )}
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> {t("new")}
          </Button>
        </div>
      </div>

      {trainings.length === 0 ? (
        <Card className="py-12 text-center">
          <Dumbbell className="mx-auto mb-4 h-12 w-12 text-[var(--muted-foreground)]" />
          <p className="text-[var(--muted-foreground)]">{t("empty")}</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {trainings.map((tr) => {
            const userVote = getUserVote(tr);
            const available = tr.votes.filter((v) => v.status === "AVAILABLE").length;
            const maybe = tr.votes.filter((v) => v.status === "MAYBE").length;
            const unavailable = tr.votes.filter((v) => v.status === "UNAVAILABLE").length;
            const state = attendanceState(tr);

            return (
              <Card key={tr.id} hover>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-[var(--foreground)]">{tr.title}</h3>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge variant="info">{TRAINING_TYPES.find((tt) => tt.value === tr.type)?.label || tr.type}</Badge>
                      <Badge variant={state === "open" ? "success" : state === "closed" ? "outline" : "default"}>
                        {state === "open" ? "Abstimmung offen" : state === "closed" ? "Abstimmung zu" : "Abstimmung geplant"}
                      </Badge>
                      {tr.recurrence && tr.recurrence !== "NONE" && (
                        <Badge variant="outline">
                          <Repeat className="mr-1 h-3 w-3" /> {recurrenceLabel(tr.recurrence)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(tr)} className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    {user?.isAdmin && state !== "open" && (
                      <button
                        onClick={() => activateAttendance(tr.id)}
                        disabled={activatingId === tr.id}
                        className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--primary)] disabled:opacity-50"
                        title="Abstimmung jetzt aktivieren"
                      >
                        <PlayCircle className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => handleDelete(tr.id)} className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mb-3 space-y-1 text-sm text-[var(--muted-foreground)]">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {formatDate(tr.date)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {t("meetTime")}: {formatTime(tr.meetTime)} · {t("start")}: {formatTime(tr.date)}
                    {tr.endDate && <> · {t("end")}: {formatTime(tr.endDate)}</>}
                  </div>
                  {tr.attendanceOpensAt && (
                    <div className="text-xs">
                      Abstimmung startet: {formatDate(tr.attendanceOpensAt)}
                    </div>
                  )}
                  {tr.attendanceClosesAt && (
                    <div className="text-xs">
                      Abstimmung endet: {formatDate(tr.attendanceClosesAt)}
                    </div>
                  )}
                  <div className="text-xs">
                    Standardfenster: {tr.attendanceOpenHoursBefore ?? 72}h vorher öffnen, {tr.attendanceCloseHoursBefore ?? 2}h vorher schließen
                  </div>
                  {tr.location && <div className="text-xs">{tr.location}</div>}
                </div>

                {tr.notes && <p className="mb-3 text-sm text-[var(--muted-foreground)]">{tr.notes}</p>}

                <Textarea
                  label="Optionaler Grund"
                  value={voteReasons[tr.id] ?? userVote?.comment ?? ""}
                  onChange={(e) => setVoteReasons((prev) => ({ ...prev, [tr.id]: e.target.value }))}
                  className="mb-3 min-h-[86px]"
                />

                <div className="flex gap-2 border-t border-[var(--border)] pt-3">
                  <button
                    onClick={() => handleVote(tr.id, "AVAILABLE")}
                    disabled={state !== "open"}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium transition-all ${
                      userVote?.status === "AVAILABLE"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-green-500/10 hover:text-green-400"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    {tc("yes")} {available > 0 && `(${available})`}
                  </button>
                  <button
                    onClick={() => handleVote(tr.id, "MAYBE")}
                    disabled={state !== "open"}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium transition-all ${
                      userVote?.status === "MAYBE"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-yellow-500/10 hover:text-yellow-400"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    {tc("maybe")} {maybe > 0 && `(${maybe})`}
                  </button>
                  <button
                    onClick={() => handleVote(tr.id, "UNAVAILABLE")}
                    disabled={state !== "open"}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium transition-all ${
                      userVote?.status === "UNAVAILABLE"
                        ? "bg-red-500/20 text-red-400"
                        : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-400"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    {tc("no")} {unavailable > 0 && `(${unavailable})`}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? t("editTitle") : t("createTitle")}>
        <div className="space-y-4">
          {!editingId && templates.length > 0 && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-3">
              <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">{t("loadTemplate")}</label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
              >
                <option value="">{t("chooseTemplate")}</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.title} ({TRAINING_TYPES.find((tt) => tt.value === tpl.type)?.label || tpl.type})
                  </option>
                ))}
              </select>
            </div>
          )}

          <Input label={t("form.titleLabel")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("form.titlePlaceholder")} />
          <Select label={t("form.type")} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={TRAINING_TYPES} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t("form.meetTime")} type="datetime-local" value={form.meetTime} onChange={(e) => setForm({ ...form, meetTime: e.target.value })} />
            <Input label={t("form.start")} type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <Input label={t("form.end")} type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          <Input label={t("form.location")} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder={t("form.locationPlaceholder")} />
          <Textarea label={t("form.notes")} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label="Wiederholung"
              value={form.recurrence}
              onChange={(e) => setForm({ ...form, recurrence: e.target.value as Recurrence })}
              options={[
                { value: "NONE", label: "Einmalig" },
                { value: "DAILY", label: "Täglich" },
                { value: "WEEKLY", label: "Wöchentlich" },
                { value: "BIWEEKLY", label: "Alle 2 Wochen" },
                { value: "MONTHLY", label: "Monatlich" },
              ]}
            />
            <Input
              label="Abstimmung öffnet (h vorher)"
              type="number"
              value={form.attendanceOpenHoursBefore}
              onChange={(e) => setForm({ ...form, attendanceOpenHoursBefore: e.target.value })}
            />
            <Input
              label="Abstimmung schließt (h vorher)"
              type="number"
              value={form.attendanceCloseHoursBefore}
              onChange={(e) => setForm({ ...form, attendanceCloseHoursBefore: e.target.value })}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
            <input
              type="checkbox"
              checked={form.activateAttendanceNow}
              onChange={(e) => setForm({ ...form, activateAttendanceNow: e.target.checked })}
            />
            Abstimmung direkt aktivieren und sofort verschicken
          </label>

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleSaveAsTemplate}
              disabled={savingTemplate}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-50"
            >
              <BookTemplate className="h-3.5 w-3.5" />
              {savingTemplate ? tc("saving") : t("saveAsTemplate")}
            </button>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setShowModal(false)}>{tc("cancel")}</Button>
              <Button onClick={handleSubmit} isLoading={submitting}>{editingId ? tc("save") : tc("create")}</Button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={showTemplateManager} onClose={() => setShowTemplateManager(false)} title={t("manageTemplates") || "Vorlagen verwalten"}>
        <div className="space-y-2">
          {templates.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--muted-foreground)]">{t("noTemplates") || "Keine Vorlagen"}</p>
          ) : (
            templates.map((tpl) => (
              <div key={tpl.id} className="flex items-center justify-between rounded-lg bg-[var(--secondary)] p-3">
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">{tpl.title}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {TRAINING_TYPES.find((tt) => tt.value === tpl.type)?.label || tpl.type} · {tpl.createdBy.displayName}
                  </p>
                </div>
                <button onClick={() => handleDeleteTemplate(tpl.id)} className="rounded p-1.5 text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}
