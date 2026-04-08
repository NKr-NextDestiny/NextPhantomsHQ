"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, BarChart3, Trash2, Check, Clock, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";

interface PollOption {
  id: string;
  text: string;
  votes: number;
  votedByUser: boolean;
}

interface Poll {
  id: string;
  title: string;
  description?: string;
  options: PollOption[];
  totalVotes: number;
  allowMultiple: boolean;
  expiresAt?: string;
  isExpired: boolean;
  createdBy: { displayName: string };
  createdAt: string;
}

export default function PollsPage() {
  const { user } = useAuthStore();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", allowMultiple: false, expiresAt: "", options: ["", ""] });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Poll[]>("/api/polls");
      if (res.data) setPolls(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm({ title: "", description: "", allowMultiple: false, expiresAt: "", options: ["", ""] });
    setShowModal(true);
  };

  const addOption = () => {
    setForm({ ...form, options: [...form.options, ""] });
  };

  const removeOption = (idx: number) => {
    if (form.options.length <= 2) return;
    setForm({ ...form, options: form.options.filter((_, i) => i !== idx) });
  };

  const updateOption = (idx: number, value: string) => {
    setForm({ ...form, options: form.options.map((o, i) => (i === idx ? value : o)) });
  };

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      await api.post("/api/polls", {
        title: form.title,
        description: form.description || undefined,
        allowMultiple: form.allowMultiple,
        expiresAt: form.expiresAt || undefined,
        options: form.options.filter((o) => o.trim()),
      });
      setShowModal(false);
      load();
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (pollId: string, optionId: string) => {
    try {
      await api.post(`/api/polls/${pollId}/vote`, { optionId });
      load();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Umfrage wirklich löschen?")) return;
    try {
      await api.delete(`/api/polls/${id}`);
      load();
    } catch {
      // ignore
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
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Umfragen</h1>
          <p className="text-[var(--muted-foreground)]">Team-Umfragen erstellen und abstimmen</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Neue Umfrage
        </Button>
      </div>

      {polls.length === 0 ? (
        <Card className="py-12 text-center">
          <BarChart3 className="mx-auto mb-4 h-12 w-12 text-[var(--muted-foreground)]" />
          <p className="text-[var(--muted-foreground)]">Noch keine Umfragen erstellt.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {polls.map((poll) => {
            const maxVotes = Math.max(...poll.options.map((o) => o.votes), 1);
            return (
              <Card key={poll.id} hover>
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-[var(--foreground)]">{poll.title}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      {poll.isExpired ? (
                        <Badge variant="destructive">Abgelaufen</Badge>
                      ) : (
                        <Badge variant="success">Aktiv</Badge>
                      )}
                      {poll.allowMultiple && <Badge variant="outline">Mehrfach</Badge>}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(poll.id)} className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {poll.description && (
                  <p className="mb-3 text-sm text-[var(--muted-foreground)]">{poll.description}</p>
                )}

                <div className="mb-3 space-y-2">
                  {poll.options.map((opt) => {
                    const pct = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => !poll.isExpired && handleVote(poll.id, opt.id)}
                        disabled={poll.isExpired}
                        className={`relative w-full overflow-hidden rounded-lg p-3 text-left transition-all ${opt.votedByUser ? "ring-2 ring-[var(--primary)]" : "hover:bg-[var(--secondary)]"}`}
                      >
                        <div
                          className="absolute inset-0 bg-[var(--primary)]/10 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                        <div className="relative flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {opt.votedByUser && <Check className="h-4 w-4 text-[var(--primary)]" />}
                            <span className="text-sm font-medium text-[var(--foreground)]">{opt.text}</span>
                          </div>
                          <span className="text-sm font-bold text-[var(--muted-foreground)]">{pct}%</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                  <div className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {poll.totalVotes} Stimmen
                  </div>
                  <div className="flex items-center gap-1">
                    {poll.expiresAt && (
                      <>
                        <Clock className="h-3.5 w-3.5" /> {formatDate(poll.expiresAt)}
                      </>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                  Von {poll.createdBy.displayName} - {formatDate(poll.createdAt)}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Neue Umfrage">
        <div className="space-y-4">
          <Input label="Titel" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Worum geht es?" />
          <Textarea label="Beschreibung (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Optionen</label>
            <div className="space-y-2">
              {form.options.map((opt, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    value={opt}
                    onChange={(e) => updateOption(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none"
                  />
                  {form.options.length > 2 && (
                    <button onClick={() => removeOption(idx)} className="rounded-lg px-2 text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addOption}>
                <Plus className="h-3.5 w-3.5" /> Option hinzufügen
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allowMultiple"
              checked={form.allowMultiple}
              onChange={(e) => setForm({ ...form, allowMultiple: e.target.checked })}
              className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)]"
            />
            <label htmlFor="allowMultiple" className="text-sm text-[var(--foreground)]">Mehrere Optionen wählbar</label>
          </div>

          <Input label="Ablaufdatum (optional)" type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>Abbrechen</Button>
            <Button onClick={handleCreate} isLoading={submitting}>Erstellen</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
