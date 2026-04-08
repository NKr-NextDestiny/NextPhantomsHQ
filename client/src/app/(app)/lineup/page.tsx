"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Users, Trash2, Edit2, GripVertical } from "lucide-react";
import { api } from "@/lib/api";
import { useT } from "@/i18n/provider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

interface Player {
  id: string;
  displayName: string;
  avatarUrl?: string;
  role?: string;
}

interface Lineup {
  id: string;
  name: string;
  description?: string;
  game?: string;
  players: { playerId: string; role: string; position: number; player?: Player }[];
  createdAt: string;
}

const ROLES = ["IGL", "Entry", "AWP", "Support", "Lurker", "Rifler", "Coach", "Substitute"];

export default function LineupPage() {
  const t = useT("lineup");
  const tc = useT("common");
  const { success, error } = useToast();
  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", game: "CS2" });
  const [lineup, setLineup] = useState<{ playerId: string; role: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [linRes, plRes] = await Promise.allSettled([
        api.get<Lineup[]>("/api/lineups"),
        api.get<Player[]>("/api/users"),
      ]);
      if (linRes.status === "fulfilled" && linRes.value.data) setLineups(linRes.value.data);
      else if (linRes.status === "rejected") error(tc("loadError"));
      if (plRes.status === "fulfilled" && plRes.value.data) setPlayers(plRes.value.data);
    } catch {
      error(tc("loadError"));
    } finally {
      setLoading(false);
    }
  }, [error, tc]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: "", description: "", game: "CS2" });
    setLineup([]);
    setShowModal(true);
  };

  const openEdit = (l: Lineup) => {
    setEditingId(l.id);
    setForm({ name: l.name, description: l.description || "", game: l.game || "CS2" });
    setLineup(l.players.map((p) => ({ playerId: p.playerId, role: p.role })));
    setShowModal(true);
  };

  const addSlot = () => {
    setLineup([...lineup, { playerId: "", role: "Rifler" }]);
  };

  const removeSlot = (idx: number) => {
    setLineup(lineup.filter((_, i) => i !== idx));
  };

  const updateSlot = (idx: number, field: "playerId" | "role", value: string) => {
    setLineup(lineup.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const body = {
        ...form,
        players: lineup.map((s, i) => ({ ...s, position: i })),
      };
      if (editingId) {
        await api.put(`/api/lineups/${editingId}`, body);
        success(tc("saved"));
      } else {
        await api.post("/api/lineups", body);
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
      await api.delete(`/api/lineups/${id}`);
      success(tc("deleted"));
      load();
    } catch {
      error(tc("deleteError"));
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

      {lineups.length === 0 ? (
        <Card className="py-12 text-center">
          <Users className="mx-auto mb-4 h-12 w-12 text-[var(--muted-foreground)]" />
          <p className="text-[var(--muted-foreground)]">{t("empty")}</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {lineups.map((l) => (
            <Card key={l.id} hover>
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[var(--foreground)]">{l.name}</h3>
                  </div>
                  {l.description && <p className="mt-1 text-sm text-[var(--muted-foreground)]">{l.description}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(l)} className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(l.id)} className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {l.players.sort((a, b) => a.position - b.position).map((p) => (
                  <div key={p.playerId} className="flex items-center gap-3 rounded-lg bg-[var(--secondary)] p-2.5">
                    {p.player?.avatarUrl ? (
                      <img src={p.player.avatarUrl} alt="" className="h-8 w-8 rounded-full" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)]/20 text-xs font-bold text-[var(--primary)]">
                        {p.player?.displayName?.charAt(0) || "?"}
                      </div>
                    )}
                    <span className="flex-1 text-sm font-medium text-[var(--foreground)]">{p.player?.displayName || tc("unknown")}</span>
                    <Badge variant="outline">{p.role}</Badge>
                  </div>
                ))}
                {l.players.length === 0 && (
                  <p className="text-sm text-[var(--muted-foreground)]">{t("noPlayers")}</p>
                )}
              </div>
              <p className="mt-3 text-xs text-[var(--muted-foreground)]">{tc("created")}: {formatDate(l.createdAt)}</p>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? t("editTitle") : t("createTitle")} size="lg">
        <div className="space-y-4">
          <Input label={t("form.name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("form.namePlaceholder")} />
          <Textarea label={t("form.description")} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-[var(--foreground)]">{t("players")}</label>
              <Button variant="outline" size="sm" onClick={addSlot}>
                <Plus className="h-3.5 w-3.5" /> {t("slot")}
              </Button>
            </div>
            <div className="space-y-2">
              {lineup.map((slot, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] p-2">
                  <GripVertical className="h-4 w-4 text-[var(--muted-foreground)]" />
                  <select
                    value={slot.playerId}
                    onChange={(e) => updateSlot(idx, "playerId", e.target.value)}
                    className="flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm text-[var(--foreground)]"
                  >
                    <option value="">{t("choosePlayer")}</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>{p.displayName}</option>
                    ))}
                  </select>
                  <select
                    value={slot.role}
                    onChange={(e) => updateSlot(idx, "role", e.target.value)}
                    className="w-32 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm text-[var(--foreground)]"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <button onClick={() => removeSlot(idx)} className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {lineup.length === 0 && (
                <p className="py-4 text-center text-sm text-[var(--muted-foreground)]">{t("noSlots")}</p>
              )}
            </div>
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
