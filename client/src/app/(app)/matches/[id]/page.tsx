"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Upload, Trash2, Download, Users, Shield, Film, UserPlus, ClipboardList } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Textarea } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";

interface PlayerStat {
  id: string;
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  kd?: number;
  externalName?: string;
  user?: { id: string; displayName: string; avatarUrl?: string };
}

interface MossFile {
  id: string;
  fileName: string;
  fileSize: number;
  playerName?: string;
  uploadedBy: { displayName: string };
  createdAt: string;
}

interface Replay {
  id: string;
  fileName: string;
  parsed: boolean;
  rounds: any[];
}

interface MatchDetail {
  id: string;
  opponent: string;
  date: string;
  map: string;
  scoreUs: number;
  scoreThem: number;
  result: string;
  competition?: string;
  notes?: string;
  side?: string;
  playerStats: PlayerStat[];
  mossFiles: MossFile[];
  replay?: Replay;
  createdBy: { displayName: string };
}

interface TeamMember {
  id: string;
  role: string;
  user: { id: string; displayName: string; avatarUrl?: string };
}

export default function MatchDetailPage() {
  const params = useParams();
  const matchId = params.id as string;
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"stats" | "moss" | "replay" | "review">("stats");

  // Player form
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [playerForm, setPlayerForm] = useState({ userId: "", externalName: "", kills: "0", deaths: "0", assists: "0", headshots: "0" });
  const [submitting, setSubmitting] = useState(false);

  // MOSS upload
  const [mossPlayerName, setMossPlayerName] = useState("");
  const [uploading, setUploading] = useState(false);

  // Review
  const [reviewExists, setReviewExists] = useState(false);
  const [reviewForm, setReviewForm] = useState({ positives: "", negatives: "", improvements: "", notes: "" });
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const { success: toastSuccess, error: toastError } = useToast();

  const load = useCallback(async () => {
    try {
      const [matchRes, membersRes] = await Promise.allSettled([
        api.get<MatchDetail>(`/api/matches/${matchId}`),
        api.get<TeamMember[]>("/api/team/members"),
      ]);
      if (matchRes.status === "fulfilled" && matchRes.value.data) setMatch(matchRes.value.data);
      if (membersRes.status === "fulfilled" && membersRes.value.data) setMembers(membersRes.value.data);
    } catch {
      toastError("Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, [matchId, toastError]);

  useEffect(() => { load(); }, [load]);

  const loadReview = useCallback(async () => {
    setReviewLoading(true);
    try {
      const res = await api.get<{ positives?: string; negatives?: string; improvements?: string; notes?: string } | null>(`/api/matches/${matchId}/review`);
      if (res.data) {
        setReviewExists(true);
        setReviewForm({
          positives: res.data.positives || "",
          negatives: res.data.negatives || "",
          improvements: res.data.improvements || "",
          notes: res.data.notes || "",
        });
      } else {
        setReviewExists(false);
        setReviewForm({ positives: "", negatives: "", improvements: "", notes: "" });
      }
    } catch {
      setReviewExists(false);
    } finally {
      setReviewLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    if (tab === "review") loadReview();
  }, [tab, loadReview]);

  const saveReview = async () => {
    setReviewSubmitting(true);
    try {
      await api.put(`/api/matches/${matchId}/review`, {
        positives: reviewForm.positives || null,
        negatives: reviewForm.negatives || null,
        improvements: reviewForm.improvements || null,
        notes: reviewForm.notes || null,
      });
      setReviewExists(true);
      toastSuccess("Review gespeichert.");
    } catch {
      toastError("Fehler beim Speichern des Reviews.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const deleteReview = async () => {
    if (!confirm("Review wirklich löschen?")) return;
    try {
      await api.delete(`/api/matches/${matchId}/review`);
      setReviewExists(false);
      setReviewForm({ positives: "", negatives: "", improvements: "", notes: "" });
      toastSuccess("Review gelöscht.");
    } catch {
      toastError("Fehler beim Löschen des Reviews.");
    }
  };

  const addPlayerStat = async () => {
    setSubmitting(true);
    try {
      const stats = [{
        userId: playerForm.userId || null,
        externalName: playerForm.externalName || null,
        kills: parseInt(playerForm.kills),
        deaths: parseInt(playerForm.deaths),
        assists: parseInt(playerForm.assists),
        headshots: parseInt(playerForm.headshots),
      }];

      // Combine existing + new stats
      const existing = match?.playerStats.map(ps => ({
        userId: ps.user?.id || null,
        externalName: ps.externalName || null,
        kills: ps.kills,
        deaths: ps.deaths,
        assists: ps.assists,
        headshots: ps.headshots,
      })) || [];

      await api.put(`/api/matches/${matchId}`, { playerStats: [...existing, ...stats] });
      toastSuccess("Gespeichert");
      setShowAddPlayer(false);
      setPlayerForm({ userId: "", externalName: "", kills: "0", deaths: "0", assists: "0", headshots: "0" });
      load();
    } catch {
      toastError("Fehler beim Speichern");
    } finally {
      setSubmitting(false);
    }
  };

  const removePlayerStat = async (statToRemove: PlayerStat) => {
    if (!confirm("Spieler-Statistik entfernen?")) return;
    try {
      const remaining = match?.playerStats
        .filter(ps => ps.id !== statToRemove.id)
        .map(ps => ({
          userId: ps.user?.id || null,
          externalName: ps.externalName || null,
          kills: ps.kills,
          deaths: ps.deaths,
          assists: ps.assists,
          headshots: ps.headshots,
        })) || [];
      await api.put(`/api/matches/${matchId}`, { playerStats: remaining });
      toastSuccess("Gelöscht");
      load();
    } catch {
      toastError("Fehler beim Löschen");
    }
  };

  const uploadMoss = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (mossPlayerName) formData.append("playerName", mossPlayerName);
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/moss/match/${matchId}`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      toastSuccess("MOSS hochgeladen");
      setMossPlayerName("");
      load();
    } catch {
      toastError("Fehler beim Hochladen");
    } finally {
      setUploading(false);
    }
  };

  const deleteMoss = async (id: string) => {
    if (!confirm("MOSS-Datei löschen?")) return;
    try {
      await api.delete(`/api/moss/${id}`);
      toastSuccess("Gelöscht");
      load();
    } catch {
      toastError("Fehler beim Löschen");
    }
  };

  const uploadReplay = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("matchId", matchId);
      if (match) {
        formData.append("map", match.map);
        formData.append("opponent", match.opponent);
        formData.append("matchDate", match.date);
      }
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/replays`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      toastSuccess("Replay hochgeladen");
      load();
    } catch {
      toastError("Fehler beim Hochladen");
    } finally {
      setUploading(false);
    }
  };

  const deleteReplay = async (id: string) => {
    if (!confirm("Replay löschen?")) return;
    try {
      await api.delete(`/api/replays/${id}`);
      toastSuccess("Gelöscht");
      load();
    } catch {
      toastError("Fehler beim Löschen");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--primary)]" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="space-y-4">
        <Link href="/matches" className="inline-flex items-center gap-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
          <ArrowLeft className="h-4 w-4" /> Zurück zu Matches
        </Link>
        <p className="text-[var(--muted-foreground)]">Match nicht gefunden.</p>
      </div>
    );
  }

  const resultColor = match.result === "WIN" ? "text-green-400" : match.result === "LOSS" ? "text-red-400" : "text-yellow-400";
  const resultBg = match.result === "WIN" ? "bg-green-500/10" : match.result === "LOSS" ? "bg-red-500/10" : "bg-yellow-500/10";

  return (
    <div className="space-y-6">
      <Link href="/matches" className="inline-flex items-center gap-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
        <ArrowLeft className="h-4 w-4" /> Zurück zu Matches
      </Link>

      {/* Match Header */}
      <Card className={`p-6 ${resultBg}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">vs. {match.opponent}</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
              <Badge variant="outline">{match.map}</Badge>
              {match.competition && <Badge variant="info">{match.competition}</Badge>}
              <span>{formatDate(match.date)}</span>
            </div>
          </div>
          <div className="text-center">
            <p className={`text-4xl font-bold ${resultColor}`}>{match.scoreUs} : {match.scoreThem}</p>
            <Badge variant={match.result === "WIN" ? "default" : match.result === "LOSS" ? "destructive" : "outline"}>
              {match.result === "WIN" ? "Sieg" : match.result === "LOSS" ? "Niederlage" : "Unentschieden"}
            </Badge>
          </div>
        </div>
        {match.notes && <p className="mt-3 text-sm text-[var(--muted-foreground)]">{match.notes}</p>}
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-[var(--secondary)] p-1">
        {[
          { id: "stats" as const, label: "Spieler", icon: Users },
          { id: "moss" as const, label: "MOSS-Dateien", icon: Shield },
          { id: "replay" as const, label: "Replays", icon: Film },
          { id: "review" as const, label: "Review", icon: ClipboardList },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${tab === t.id ? "bg-[var(--primary)] text-white" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Player Stats Tab */}
      {tab === "stats" && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Spieler-Statistiken</h2>
            <Button size="sm" onClick={() => setShowAddPlayer(true)}>
              <UserPlus className="h-4 w-4" /> Spieler hinzufügen
            </Button>
          </div>

          {match.playerStats.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--muted-foreground)]">Keine Spieler-Statistiken vorhanden.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                    <th className="pb-2 pr-4">Spieler</th>
                    <th className="pb-2 pr-4 text-center">K</th>
                    <th className="pb-2 pr-4 text-center">D</th>
                    <th className="pb-2 pr-4 text-center">A</th>
                    <th className="pb-2 pr-4 text-center">HS</th>
                    <th className="pb-2 pr-4 text-center">K/D</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {match.playerStats.map((ps) => (
                    <tr key={ps.id} className="border-b border-[var(--border)]/50">
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          {ps.user?.avatarUrl ? (
                            <img src={ps.user.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
                          ) : (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)]/20 text-xs font-bold text-[var(--primary)]">
                              {(ps.user?.displayName || ps.externalName || "?").charAt(0)}
                            </div>
                          )}
                          <span className="font-medium text-[var(--foreground)]">
                            {ps.user?.displayName || ps.externalName || "Unbekannt"}
                          </span>
                          {ps.externalName && !ps.user && <Badge variant="outline" className="text-xs">Extern</Badge>}
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-center text-[var(--foreground)]">{ps.kills}</td>
                      <td className="py-2 pr-4 text-center text-[var(--foreground)]">{ps.deaths}</td>
                      <td className="py-2 pr-4 text-center text-[var(--foreground)]">{ps.assists}</td>
                      <td className="py-2 pr-4 text-center text-[var(--foreground)]">{ps.headshots}</td>
                      <td className="py-2 pr-4 text-center">
                        <span className={`font-medium ${(ps.kd || 0) >= 1 ? "text-green-400" : "text-red-400"}`}>
                          {ps.kd?.toFixed(2) || "—"}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <button onClick={() => removePlayerStat(ps)} className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showAddPlayer && (
            <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-4 space-y-3">
              <h3 className="font-medium text-[var(--foreground)]">Spieler hinzufügen</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-[var(--muted-foreground)]">Team-Mitglied</label>
                  <select
                    value={playerForm.userId}
                    onChange={(e) => setPlayerForm({ ...playerForm, userId: e.target.value, externalName: "" })}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                  >
                    <option value="">— Extern / Aushilfe —</option>
                    {members.map(m => (
                      <option key={m.user.id} value={m.user.id}>{m.user.displayName}</option>
                    ))}
                  </select>
                </div>
                {!playerForm.userId && (
                  <Input label="Externer Name" value={playerForm.externalName} onChange={(e) => setPlayerForm({ ...playerForm, externalName: e.target.value })} placeholder="Name des Aushilfsspielers" />
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <Input label="Kills" type="number" value={playerForm.kills} onChange={(e) => setPlayerForm({ ...playerForm, kills: e.target.value })} />
                <Input label="Deaths" type="number" value={playerForm.deaths} onChange={(e) => setPlayerForm({ ...playerForm, deaths: e.target.value })} />
                <Input label="Assists" type="number" value={playerForm.assists} onChange={(e) => setPlayerForm({ ...playerForm, assists: e.target.value })} />
                <Input label="Headshots" type="number" value={playerForm.headshots} onChange={(e) => setPlayerForm({ ...playerForm, headshots: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={addPlayerStat} isLoading={submitting}>Hinzufügen</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddPlayer(false)}>Abbrechen</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* MOSS Tab */}
      {tab === "moss" && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">MOSS-Dateien</h2>

          {/* Upload */}
          <div className="mb-4 flex items-end gap-3 rounded-lg border border-dashed border-[var(--border)] p-4">
            <Input label="Spielername" value={mossPlayerName} onChange={(e) => setMossPlayerName(e.target.value)} placeholder="Welcher Spieler?" className="flex-1" />
            <div>
              <input
                type="file"
                id="moss-upload"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadMoss(e.target.files[0])}
              />
              <Button size="sm" onClick={() => document.getElementById("moss-upload")?.click()} isLoading={uploading}>
                <Upload className="h-4 w-4" /> MOSS hochladen
              </Button>
            </div>
          </div>

          {/* File List */}
          {match.mossFiles.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--muted-foreground)]">Keine MOSS-Dateien vorhanden.</p>
          ) : (
            <div className="space-y-2">
              {match.mossFiles.map((f) => (
                <div key={f.id} className="flex items-center gap-3 rounded-lg bg-[var(--secondary)] p-3">
                  <Shield className="h-5 w-5 shrink-0 text-[var(--primary)]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">{f.fileName}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {f.playerName && <span className="text-[var(--primary)]">{f.playerName}</span>}
                      {f.playerName && " · "}
                      {(f.fileSize / 1024).toFixed(0)} KB · {formatDate(f.createdAt)}
                    </p>
                  </div>
                  <a
                    href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/moss/${f.id}/download`}
                    className="rounded p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <button onClick={() => deleteMoss(f.id)} className="rounded p-1.5 text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Review Tab */}
      {tab === "review" && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Match Review</h2>
            {reviewExists && (
              <Button size="sm" variant="destructive" onClick={deleteReview}>
                <Trash2 className="h-4 w-4" /> Review löschen
              </Button>
            )}
          </div>

          {reviewLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--primary)]" />
            </div>
          ) : (
            <div className="space-y-4">
              <Textarea
                label="Positives"
                value={reviewForm.positives}
                onChange={(e) => setReviewForm({ ...reviewForm, positives: e.target.value })}
                placeholder="Was lief gut?"
                rows={3}
              />
              <Textarea
                label="Negatives"
                value={reviewForm.negatives}
                onChange={(e) => setReviewForm({ ...reviewForm, negatives: e.target.value })}
                placeholder="Was lief schlecht?"
                rows={3}
              />
              <Textarea
                label="Verbesserungen"
                value={reviewForm.improvements}
                onChange={(e) => setReviewForm({ ...reviewForm, improvements: e.target.value })}
                placeholder="Was kann verbessert werden?"
                rows={3}
              />
              <Textarea
                label="Notizen"
                value={reviewForm.notes}
                onChange={(e) => setReviewForm({ ...reviewForm, notes: e.target.value })}
                placeholder="Weitere Notizen..."
                rows={3}
              />
              <div className="flex justify-end pt-2">
                <Button onClick={saveReview} isLoading={reviewSubmitting}>
                  {reviewExists ? "Review aktualisieren" : "Review speichern"}
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Replay Tab */}
      {tab === "replay" && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">Replay</h2>

          {match.replay ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-[var(--secondary)] p-3">
                <Film className="h-5 w-5 shrink-0 text-[var(--primary)]" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)]">{match.replay.fileName}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {match.replay.parsed ? `${match.replay.rounds?.length || 0} Runden geparst` : "Wird geparst..."}
                  </p>
                </div>
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/replays/${match.replay.id}/download`}
                  className="rounded p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  <Download className="h-4 w-4" />
                </a>
                <button onClick={() => deleteReplay(match.replay!.id)} className="rounded p-1.5 text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center">
              <Film className="mx-auto mb-2 h-8 w-8 text-[var(--muted-foreground)]" />
              <p className="mb-3 text-sm text-[var(--muted-foreground)]">Kein Replay vorhanden. Lade eine .rec oder .zip Datei hoch.</p>
              <input
                type="file"
                id="replay-upload"
                accept=".rec,.zip"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadReplay(e.target.files[0])}
              />
              <Button size="sm" onClick={() => document.getElementById("replay-upload")?.click()} isLoading={uploading}>
                <Upload className="h-4 w-4" /> Replay hochladen
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
