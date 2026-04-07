"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Film, Upload, Download, Trash2, Edit2, Play, FileVideo } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";

interface Replay {
  id: string;
  title: string;
  map: string;
  opponent?: string;
  date: string;
  fileUrl?: string;
  fileSize?: number;
  notes?: string;
  rounds?: { number: number; winner: string; highlight?: string }[];
  uploadedBy?: { displayName: string };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const CS_MAPS = ["Mirage", "Inferno", "Nuke", "Overpass", "Ancient", "Anubis", "Dust2", "Vertigo"];

export default function ReplaysPage() {
  const [replays, setReplays] = useState<Replay[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState({ title: "", map: "Mirage", opponent: "", date: "", notes: "" });
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [detailReplay, setDetailReplay] = useState<Replay | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Replay[]>("/api/replays");
      if (res.data) setReplays(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async () => {
    if (!file) return;
    setSubmitting(true);
    try {
      await api.upload("/api/replays", file, {
        title: form.title,
        map: form.map,
        opponent: form.opponent,
        date: form.date,
        notes: form.notes,
      });
      setShowUpload(false);
      setFile(null);
      load();
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Replay wirklich loeschen?")) return;
    try {
      await api.delete(`/api/replays/${id}`);
      load();
    } catch {
      // ignore
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Replays</h1>
          <p className="text-[var(--muted-foreground)]">Demo-Dateien verwalten und analysieren</p>
        </div>
        <Button onClick={() => { setForm({ title: "", map: "Mirage", opponent: "", date: "", notes: "" }); setFile(null); setShowUpload(true); }}>
          <Upload className="h-4 w-4" /> Replay hochladen
        </Button>
      </div>

      {replays.length === 0 ? (
        <Card className="py-12 text-center">
          <Film className="mx-auto mb-4 h-12 w-12 text-[var(--muted-foreground)]" />
          <p className="text-[var(--muted-foreground)]">Noch keine Replays hochgeladen.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {replays.map((r) => (
            <Card key={r.id} hover>
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-[var(--foreground)]">{r.title}</h3>
                  <div className="mt-1 flex gap-2">
                    <Badge variant="info">{r.map}</Badge>
                    {r.opponent && <Badge variant="outline">vs. {r.opponent}</Badge>}
                  </div>
                </div>
                <button onClick={() => handleDelete(r.id)} className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-3 space-y-1 text-sm text-[var(--muted-foreground)]">
                <p>{formatDate(r.date)}</p>
                {r.fileSize && <p>{formatFileSize(r.fileSize)}</p>}
                {r.uploadedBy && <p>Von: {r.uploadedBy.displayName}</p>}
              </div>

              {r.notes && <p className="mb-3 text-sm text-[var(--muted-foreground)]">{r.notes}</p>}

              <div className="flex gap-2 border-t border-[var(--border)] pt-3">
                {r.fileUrl && (
                  <a
                    href={`${API_URL}${r.fileUrl}`}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-white transition-all hover:bg-orange-600"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </a>
                )}
                {r.rounds && r.rounds.length > 0 && (
                  <button
                    onClick={() => setDetailReplay(r)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:text-[var(--foreground)]"
                  >
                    <Play className="h-3.5 w-3.5" /> Runden
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <Modal open={showUpload} onClose={() => setShowUpload(false)} title="Replay hochladen" size="lg">
        <div className="space-y-4">
          <Input label="Titel" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="z.B. Liga Match vs. Team X" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Map" value={form.map} onChange={(e) => setForm({ ...form, map: e.target.value })} options={CS_MAPS.map((m) => ({ value: m, label: m }))} />
            <Input label="Gegner" value={form.opponent} onChange={(e) => setForm({ ...form, opponent: e.target.value })} />
          </div>
          <Input label="Datum" type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Textarea label="Notizen" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--foreground)]">Demo-Datei</label>
            <div className="rounded-lg border-2 border-dashed border-[var(--border)] p-6 text-center">
              <FileVideo className="mx-auto mb-2 h-8 w-8 text-[var(--muted-foreground)]" />
              <input type="file" accept=".dem,.demo,.zip,.rar" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-sm text-[var(--muted-foreground)] file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--primary)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white" />
              {file && <p className="mt-2 text-sm text-[var(--foreground)]">{file.name} ({formatFileSize(file.size)})</p>}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowUpload(false)}>Abbrechen</Button>
            <Button onClick={handleUpload} isLoading={submitting} disabled={!file}>Hochladen</Button>
          </div>
        </div>
      </Modal>

      {/* Round Browser */}
      <Modal open={!!detailReplay} onClose={() => setDetailReplay(null)} title={`Runden: ${detailReplay?.title}`} size="lg">
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {detailReplay?.rounds?.map((r) => (
            <div key={r.number} className="flex items-center gap-3 rounded-lg bg-[var(--secondary)] p-3">
              <span className="w-8 text-center text-sm font-bold text-[var(--foreground)]">{r.number}</span>
              <Badge variant={r.winner === "us" ? "success" : "destructive"}>
                {r.winner === "us" ? "Sieg" : "Niederlage"}
              </Badge>
              {r.highlight && <span className="text-sm text-[var(--muted-foreground)]">{r.highlight}</span>}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
