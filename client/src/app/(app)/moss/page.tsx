"use client";
import { useEffect, useState, useCallback } from "react";
import { Shield, Upload, Download, Trash2, Lock, FileCheck, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";

interface MossFile {
  id: string;
  matchId?: string;
  matchLabel?: string;
  uploadedBy: { displayName: string; avatarUrl?: string };
  uploadedAt: string;
  fileUrl: string;
  fileSize: number;
  status: "pending" | "verified" | "flagged";
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function MossPage() {
  const [files, setFiles] = useState<MossFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [matchId, setMatchId] = useState("");
  const [matches, setMatches] = useState<{ id: string; label: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [filesRes, matchesRes] = await Promise.allSettled([
        api.get<MossFile[]>("/api/moss"),
        api.get<any[]>("/api/matches?limit=20"),
      ]);
      if (filesRes.status === "fulfilled" && filesRes.value.data) setFiles(filesRes.value.data);
      if (matchesRes.status === "fulfilled" && matchesRes.value.data) {
        setMatches(matchesRes.value.data.map((m: any) => ({ id: m.id, label: `vs. ${m.opponent} - ${new Date(m.date).toLocaleDateString("de-DE")}` })));
      }
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
      const data: Record<string, string> = {};
      if (matchId) data.matchId = matchId;
      await api.upload("/api/moss", file, data);
      setShowUpload(false);
      setFile(null);
      setMatchId("");
      load();
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("MOSS-Datei wirklich löschen?")) return;
    try {
      await api.delete(`/api/moss/${id}`);
      load();
    } catch {
      // ignore
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "verified": return <Badge variant="success"><FileCheck className="mr-1 h-3 w-3" />Verifiziert</Badge>;
      case "flagged": return <Badge variant="destructive"><AlertCircle className="mr-1 h-3 w-3" />Markiert</Badge>;
      default: return <Badge variant="warning">Ausstehend</Badge>;
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
          <h1 className="text-2xl font-bold text-[var(--foreground)]">MOSS</h1>
          <p className="text-[var(--muted-foreground)]">MOSS Anti-Cheat Dateien verwalten</p>
        </div>
        <Button onClick={() => { setFile(null); setMatchId(""); setShowUpload(true); }}>
          <Upload className="h-4 w-4" /> MOSS hochladen
        </Button>
      </div>

      <Card className="flex items-center gap-3 border-blue-500/30 bg-blue-500/5 p-4">
        <Lock className="h-5 w-5 text-blue-400" />
        <p className="text-sm text-blue-300">MOSS-Dateien werden verschlüsselt gespeichert und sind nur für Team-Admins sichtbar.</p>
      </Card>

      {files.length === 0 ? (
        <Card className="py-12 text-center">
          <Shield className="mx-auto mb-4 h-12 w-12 text-[var(--muted-foreground)]" />
          <p className="text-[var(--muted-foreground)]">Noch keine MOSS-Dateien hochgeladen.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {files.map((f) => (
            <Card key={f.id} hover className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--secondary)]">
                <Shield className="h-5 w-5 text-[var(--primary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--foreground)]">
                    {f.matchLabel || "Kein Match zugeordnet"}
                  </span>
                  {statusBadge(f.status)}
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {f.uploadedBy.displayName} - {formatDate(f.uploadedAt)} - {formatFileSize(f.fileSize)}
                </p>
              </div>
              <div className="flex gap-2">
                <a
                  href={`${API_URL}${f.fileUrl}`}
                  className="flex items-center gap-1 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:text-[var(--foreground)]"
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
                <button onClick={() => handleDelete(f.id)} className="rounded p-2 text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showUpload} onClose={() => setShowUpload(false)} title="MOSS-Datei hochladen">
        <div className="space-y-4">
          <Select
            label="Match zuordnen (optional)"
            value={matchId}
            onChange={(e) => setMatchId(e.target.value)}
            options={[{ value: "", label: "Kein Match" }, ...matches.map((m) => ({ value: m.id, label: m.label }))]}
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--foreground)]">MOSS-Datei</label>
            <div className="rounded-lg border-2 border-dashed border-[var(--border)] p-6 text-center">
              <Shield className="mx-auto mb-2 h-8 w-8 text-[var(--muted-foreground)]" />
              <input type="file" accept=".zip,.rar,.7z" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-sm text-[var(--muted-foreground)] file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--primary)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white" />
              {file && <p className="mt-2 text-sm text-[var(--foreground)]">{file.name} ({formatFileSize(file.size)})</p>}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowUpload(false)}>Abbrechen</Button>
            <Button onClick={handleUpload} isLoading={submitting} disabled={!file}>Hochladen</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
