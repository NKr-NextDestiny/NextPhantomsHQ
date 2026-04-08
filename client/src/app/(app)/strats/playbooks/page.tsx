"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Edit2, BookOpen, GripVertical } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

interface Strat {
  id: string;
  title: string;
  map: string;
  side: string;
  type?: string;
}

interface PlaybookStrat {
  id: string;
  order: number;
  strat: Strat;
}

interface Playbook {
  id: string;
  name: string;
  description?: string;
  createdBy?: { displayName: string };
  strats: PlaybookStrat[];
  createdAt: string;
  updatedAt: string;
}

export default function PlaybooksPage() {
  const { success, error: showError } = useToast();
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [allStrats, setAllStrats] = useState<Strat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [addStratModal, setAddStratModal] = useState<string | null>(null);
  const [selectedStratId, setSelectedStratId] = useState("");

  const load = useCallback(async () => {
    try {
      const [pbRes, stratRes] = await Promise.all([
        api.get<Playbook[]>("/api/strats/playbooks/list"),
        api.get<Strat[]>("/api/strats"),
      ]);
      if (pbRes.data) setPlaybooks(pbRes.data);
      if (stratRes.data) setAllStrats(stratRes.data);
    } catch (e) {
      showError("Fehler beim Laden der Playbooks");
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await api.put(`/api/strats/playbooks/${editingId}`, form);
        success("Playbook aktualisiert");
      } else {
        await api.post("/api/strats/playbooks", form);
        success("Playbook erstellt");
      }
      setShowModal(false);
      setEditingId(null);
      setForm({ name: "", description: "" });
      load();
    } catch {
      showError("Fehler beim Speichern");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Playbook wirklich loschen?")) return;
    try {
      await api.delete(`/api/strats/playbooks/${id}`);
      success("Playbook geloscht");
      load();
    } catch {
      showError("Fehler beim Loschen");
    }
  };

  const handleAddStrat = async (playbookId: string) => {
    if (!selectedStratId) return;
    try {
      const currentPb = playbooks.find(p => p.id === playbookId);
      const order = (currentPb?.strats.length ?? 0);
      await api.post(`/api/strats/playbooks/${playbookId}/strats`, { stratId: selectedStratId, order });
      success("Strat hinzugefugt");
      setAddStratModal(null);
      setSelectedStratId("");
      load();
    } catch {
      showError("Fehler beim Hinzufugen");
    }
  };

  const handleRemoveStrat = async (playbookId: string, stratId: string) => {
    try {
      await api.delete(`/api/strats/playbooks/${playbookId}/strats/${stratId}`);
      success("Strat entfernt");
      load();
    } catch {
      showError("Fehler beim Entfernen");
    }
  };

  const openEdit = (pb: Playbook) => {
    setEditingId(pb.id);
    setForm({ name: pb.name, description: pb.description || "" });
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Playbooks</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Strategien in Playbooks organisieren</p>
        </div>
        <Button onClick={() => { setEditingId(null); setForm({ name: "", description: "" }); setShowModal(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Neues Playbook
        </Button>
      </div>

      {playbooks.length === 0 ? (
        <Card className="p-12 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-[var(--muted-foreground)] mb-4" />
          <p className="text-[var(--muted-foreground)]">Noch keine Playbooks erstellt</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {playbooks.map(pb => (
            <Card key={pb.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold">{pb.name}</h2>
                  {pb.description && <p className="text-sm text-[var(--muted-foreground)] mt-1">{pb.description}</p>}
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    {pb.strats.length} Strat{pb.strats.length !== 1 ? "s" : ""} &middot; Erstellt von {pb.createdBy?.displayName}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => { setAddStratModal(pb.id); setSelectedStratId(""); }}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => openEdit(pb)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(pb.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {pb.strats.length > 0 ? (
                <div className="space-y-2">
                  {pb.strats
                    .sort((a, b) => a.order - b.order)
                    .map((ps, i) => (
                      <div key={ps.id} className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-3">
                        <GripVertical className="h-4 w-4 text-[var(--muted-foreground)]" />
                        <span className="text-sm font-medium text-[var(--muted-foreground)] w-6">{i + 1}.</span>
                        <div className="flex-1">
                          <span className="font-medium">{ps.strat.title}</span>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="secondary">{ps.strat.map}</Badge>
                            <Badge variant={ps.strat.side === "ATTACK" ? "warning" : "default"}>{ps.strat.side}</Badge>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveStrat(pb.id, ps.strat.id)}
                          className="text-[var(--muted-foreground)] hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--muted-foreground)] italic">Keine Strats zugeordnet</p>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Playbook Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingId ? "Playbook bearbeiten" : "Neues Playbook"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <Textarea label="Beschreibung" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Abbrechen</Button>
            <Button type="submit" loading={submitting}>{editingId ? "Speichern" : "Erstellen"}</Button>
          </div>
        </form>
      </Modal>

      {/* Add Strat to Playbook Modal */}
      <Modal open={!!addStratModal} onClose={() => setAddStratModal(null)} title="Strat hinzufugen">
        <div className="space-y-4">
          <Select
            label="Strat auswahlen"
            value={selectedStratId}
            onChange={e => setSelectedStratId(e.target.value)}
          >
            <option value="">-- Strat wahlen --</option>
            {allStrats
              .filter(s => {
                const pb = playbooks.find(p => p.id === addStratModal);
                return !pb?.strats.some(ps => ps.strat.id === s.id);
              })
              .map(s => (
                <option key={s.id} value={s.id}>{s.title} ({s.map} - {s.side})</option>
              ))}
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAddStratModal(null)}>Abbrechen</Button>
            <Button onClick={() => addStratModal && handleAddStrat(addStratModal)} disabled={!selectedStratId}>Hinzufugen</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
