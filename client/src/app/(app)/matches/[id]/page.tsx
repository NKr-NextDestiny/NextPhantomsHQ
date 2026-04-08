"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, Upload, Trash2, Download, Users, Shield, Film, UserPlus, ClipboardList, CheckCircle, XCircle, HelpCircle, Star } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { useAuthStore } from "@/lib/auth-store";
import { useT } from "@/i18n/provider";
import Link from "next/link";
import { CommentSection } from "@/components/ui/CommentSection";

type MatchType = "SCRIM" | "TOURNAMENT" | "LEAGUE" | "FRIENDLY" | "OTHER";

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

interface MatchVote {
  id: string;
  status: string;
  comment?: string | null;
  userId: string;
  user: { displayName: string; avatarUrl?: string };
}

interface MatchDetail {
  id: string;
  type: MatchType;
  opponent: string;
  date: string;
  map?: string | null;
  scoreUs?: number | null;
  scoreThem?: number | null;
  result?: string | null;
  competition?: string | null;
  notes?: string | null;
  side?: string | null;
  meetTime?: string | null;
  endDate?: string | null;
  mapPool?: string[];
  format?: string | null;
  contactInfo?: string | null;
  serverRegion?: string | null;
  skillRating?: number | null;
  communicationRating?: number | null;
  punctualityRating?: number | null;
  mapResults?: any;
  votes?: MatchVote[];
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
  const t = useT("matches");
  const tc = useT("common");
  const params = useParams();
  const matchId = params.id as string;
  const { user } = useAuthStore();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const matchTabs = ["stats", "moss", "replay", "review", "attendance"] as const;
  type MatchTab = typeof matchTabs[number];
  const initTab = matchTabs.includes(searchParams.get("tab") as MatchTab) ? (searchParams.get("tab") as MatchTab) : "stats";
  const [tab, setTabState] = useState<MatchTab>(initTab);
  const setTab = (t: MatchTab) => {
    setTabState(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    window.history.replaceState({}, "", url.toString());
  };

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

  // Result modal (for scrims)
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultForm, setResultForm] = useState({ scoreUs: "0", scoreThem: "0", skillRating: "", communicationRating: "", punctualityRating: "" });
  const [resultSubmitting, setResultSubmitting] = useState(false);

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
      toastError(tc("loadError"));
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
        setReviewForm({ positives: res.data.positives || "", negatives: res.data.negatives || "", improvements: res.data.improvements || "", notes: res.data.notes || "" });
      } else {
        setReviewExists(false);
        setReviewForm({ positives: "", negatives: "", improvements: "", notes: "" });
      }
    } catch { setReviewExists(false); }
    finally { setReviewLoading(false); }
  }, [matchId]);

  useEffect(() => { if (tab === "review") loadReview(); }, [tab, loadReview]);

  const saveReview = async () => {
    setReviewSubmitting(true);
    try {
      await api.put(`/api/matches/${matchId}/review`, {
        positives: reviewForm.positives || null, negatives: reviewForm.negatives || null,
        improvements: reviewForm.improvements || null, notes: reviewForm.notes || null,
      });
      setReviewExists(true);
      toastSuccess(t("detail.reviewSaved"));
    } catch { toastError(t("detail.reviewSaveError")); }
    finally { setReviewSubmitting(false); }
  };

  const deleteReview = async () => {
    if (!confirm(t("detail.confirmDeleteReview"))) return;
    try {
      await api.delete(`/api/matches/${matchId}/review`);
      setReviewExists(false);
      setReviewForm({ positives: "", negatives: "", improvements: "", notes: "" });
      toastSuccess(t("detail.reviewDeleted"));
    } catch { toastError(t("detail.reviewDeleteError")); }
  };

  const addPlayerStat = async () => {
    setSubmitting(true);
    try {
      const stats = [{ userId: playerForm.userId || null, externalName: playerForm.externalName || null, kills: parseInt(playerForm.kills), deaths: parseInt(playerForm.deaths), assists: parseInt(playerForm.assists), headshots: parseInt(playerForm.headshots) }];
      const existing = match?.playerStats.map(ps => ({ userId: ps.user?.id || null, externalName: ps.externalName || null, kills: ps.kills, deaths: ps.deaths, assists: ps.assists, headshots: ps.headshots })) || [];
      await api.put(`/api/matches/${matchId}`, { playerStats: [...existing, ...stats] });
      toastSuccess(tc("saved"));
      setShowAddPlayer(false);
      setPlayerForm({ userId: "", externalName: "", kills: "0", deaths: "0", assists: "0", headshots: "0" });
      load();
    } catch { toastError(tc("saveError")); }
    finally { setSubmitting(false); }
  };

  const removePlayerStat = async (statToRemove: PlayerStat) => {
    if (!confirm(t("detail.confirmRemoveStat"))) return;
    try {
      const remaining = match?.playerStats.filter(ps => ps.id !== statToRemove.id).map(ps => ({ userId: ps.user?.id || null, externalName: ps.externalName || null, kills: ps.kills, deaths: ps.deaths, assists: ps.assists, headshots: ps.headshots })) || [];
      await api.put(`/api/matches/${matchId}`, { playerStats: remaining });
      toastSuccess(tc("deleted"));
      load();
    } catch { toastError(tc("deleteError")); }
  };

  const uploadMoss = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (mossPlayerName) formData.append("playerName", mossPlayerName);
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/moss/match/${matchId}`, { method: "POST", credentials: "include", body: formData });
      toastSuccess(t("detail.mossUploaded"));
      setMossPlayerName("");
      load();
    } catch { toastError(t("detail.uploadError")); }
    finally { setUploading(false); }
  };

  const deleteMoss = async (id: string) => {
    if (!confirm(t("detail.confirmDeleteMoss"))) return;
    try { await api.delete(`/api/moss/${id}`); toastSuccess(tc("deleted")); load(); }
    catch { toastError(tc("deleteError")); }
  };

  const uploadReplay = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("matchId", matchId);
      if (match) {
        if (match.map) formData.append("map", match.map);
        formData.append("opponent", match.opponent);
        formData.append("matchDate", match.date);
      }
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/replays`, { method: "POST", credentials: "include", body: formData });
      toastSuccess(t("detail.replayUploaded"));
      load();
    } catch { toastError(t("detail.uploadError")); }
    finally { setUploading(false); }
  };

  const deleteReplay = async (id: string) => {
    if (!confirm(t("detail.confirmDeleteReplay"))) return;
    try { await api.delete(`/api/replays/${id}`); toastSuccess(tc("deleted")); load(); }
    catch { toastError(tc("deleteError")); }
  };

  const handleVote = async (status: "AVAILABLE" | "UNAVAILABLE" | "MAYBE") => {
    const currentVote = match?.votes?.find(v => v.userId === user?.id)?.status;
    try {
      if (currentVote === status) {
        await api.delete(`/api/matches/${matchId}/vote`);
        toastSuccess(t("voteRetracted") || "Stimme zurückgezogen");
      } else {
        await api.post(`/api/matches/${matchId}/vote`, { status });
        toastSuccess(t("voteSaved"));
      }
      load();
    } catch { toastError(t("detail.voteError")); }
  };

  const handleResultSubmit = async () => {
    setResultSubmitting(true);
    try {
      await api.post(`/api/matches/${matchId}/result`, {
        scoreUs: parseInt(resultForm.scoreUs),
        scoreThem: parseInt(resultForm.scoreThem),
        skillRating: resultForm.skillRating ? parseInt(resultForm.skillRating) : null,
        communicationRating: resultForm.communicationRating ? parseInt(resultForm.communicationRating) : null,
        punctualityRating: resultForm.punctualityRating ? parseInt(resultForm.punctualityRating) : null,
      });
      toastSuccess(t("detail.resultEntered"));
      setShowResultModal(false);
      load();
    } catch { toastError(tc("saveError")); }
    finally { setResultSubmitting(false); }
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
          <ArrowLeft className="h-4 w-4" /> {t("detail.back")}
        </Link>
        <p className="text-[var(--muted-foreground)]">{t("detail.notFound")}</p>
      </div>
    );
  }

  const hasResult = match.result != null;
  const resultColor = match.result === "WIN" ? "text-green-400" : match.result === "LOSS" ? "text-red-400" : "text-yellow-400";
  const resultBg = match.result === "WIN" ? "bg-green-500/10" : match.result === "LOSS" ? "bg-red-500/10" : hasResult ? "bg-yellow-500/10" : "bg-[var(--secondary)]";
  const isScrim = match.type === "SCRIM";
  const myVote = match.votes?.find(v => v.userId === user?.id);

  const tabs = [
    { id: "stats" as const, label: t("detail.playersTab"), icon: Users },
    ...(isScrim ? [{ id: "attendance" as const, label: t("detail.attendanceTab"), icon: CheckCircle }] : []),
    { id: "moss" as const, label: t("detail.mossTab"), icon: Shield },
    { id: "replay" as const, label: t("detail.replaysTab"), icon: Film },
    { id: "review" as const, label: t("detail.reviewTab"), icon: ClipboardList },
  ];

  return (
    <div className="space-y-6">
      <Link href="/matches" className="inline-flex items-center gap-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
        <ArrowLeft className="h-4 w-4" /> {t("detail.back")}
      </Link>

      {/* Match Header */}
      <Card className={`p-6 ${resultBg}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[var(--foreground)]">vs. {match.opponent}</h1>
              <Badge variant={isScrim ? "info" : "warning"}>{t(`types.${match.type}`)}</Badge>
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm text-[var(--muted-foreground)] flex-wrap">
              {match.map && <Badge variant="outline">{match.map}</Badge>}
              {match.mapPool && match.mapPool.length > 0 && match.mapPool.map(m => (
                <Badge key={m} variant="outline">{m}</Badge>
              ))}
              {match.competition && <Badge variant="info">{match.competition}</Badge>}
              {match.format && <Badge variant="outline">{match.format}</Badge>}
              <span>{formatDate(match.date)}</span>
            </div>
            {/* Scrim-specific info */}
            {isScrim && (match.meetTime || match.contactInfo || match.serverRegion) && (
              <div className="mt-2 flex gap-4 text-xs text-[var(--muted-foreground)]">
                {match.meetTime && <span>{t("detail.meetTimeLabel")}: {formatDate(match.meetTime)}</span>}
                {match.serverRegion && <span>{t("detail.regionLabel")}: {match.serverRegion}</span>}
                {match.contactInfo && <span>{t("detail.contactLabel")}: {match.contactInfo}</span>}
              </div>
            )}
          </div>
          <div className="text-center">
            {hasResult ? (
              <>
                <p className={`text-4xl font-bold ${resultColor}`}>{match.scoreUs} : {match.scoreThem}</p>
                <Badge variant={match.result === "WIN" ? "default" : match.result === "LOSS" ? "destructive" : "outline"}>
                  {match.result === "WIN" ? t("detail.win") : match.result === "LOSS" ? t("detail.loss") : t("detail.draw")}
                </Badge>
              </>
            ) : (
              <Button size="sm" onClick={() => setShowResultModal(true)}>{t("detail.enterResult")}</Button>
            )}
          </div>
        </div>
        {match.notes && <p className="mt-3 text-sm text-[var(--muted-foreground)]">{match.notes}</p>}

        {/* Ratings */}
        {(match.skillRating || match.communicationRating || match.punctualityRating) && (
          <div className="mt-3 flex gap-4 text-xs">
            {match.skillRating != null && <span className="flex items-center gap-1 text-[var(--muted-foreground)]"><Star className="h-3 w-3 text-yellow-400" /> {t("detail.ratingSkill")}: {match.skillRating}/5</span>}
            {match.communicationRating != null && <span className="flex items-center gap-1 text-[var(--muted-foreground)]"><Star className="h-3 w-3 text-blue-400" /> {t("detail.ratingCommunication")}: {match.communicationRating}/5</span>}
            {match.punctualityRating != null && <span className="flex items-center gap-1 text-[var(--muted-foreground)]"><Star className="h-3 w-3 text-green-400" /> {t("detail.ratingPunctuality")}: {match.punctualityRating}/5</span>}
          </div>
        )}

        {/* Quick vote buttons for scrims */}
        {isScrim && !hasResult && (
          <div className="mt-3 flex items-center gap-2 border-t border-[var(--border)]/30 pt-3">
            <span className="text-xs text-[var(--muted-foreground)]">{t("detail.attendanceLabel")}:</span>
            <button onClick={() => handleVote("AVAILABLE")} className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-all ${myVote?.status === "AVAILABLE" ? "bg-green-500/20 text-green-400" : "bg-[var(--background)] text-[var(--muted-foreground)] hover:text-green-400"}`}>
              <CheckCircle className="h-3.5 w-3.5" /> {t("detail.available")}
            </button>
            <button onClick={() => handleVote("MAYBE")} className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-all ${myVote?.status === "MAYBE" ? "bg-yellow-500/20 text-yellow-400" : "bg-[var(--background)] text-[var(--muted-foreground)] hover:text-yellow-400"}`}>
              <HelpCircle className="h-3.5 w-3.5" /> {tc("maybe")}
            </button>
            <button onClick={() => handleVote("UNAVAILABLE")} className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-all ${myVote?.status === "UNAVAILABLE" ? "bg-red-500/20 text-red-400" : "bg-[var(--background)] text-[var(--muted-foreground)] hover:text-red-400"}`}>
              <XCircle className="h-3.5 w-3.5" /> {tc("no")}
            </button>
          </div>
        )}
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-[var(--secondary)] p-1 overflow-x-auto">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all whitespace-nowrap ${tab === tb.id ? "bg-[var(--primary)] text-white" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
          >
            <tb.icon className="h-4 w-4" /> {tb.label}
          </button>
        ))}
      </div>

      {/* Attendance Tab (Scrims) */}
      {tab === "attendance" && isScrim && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">{t("detail.attendanceOverview")}</h2>
          {(!match.votes || match.votes.length === 0) ? (
            <p className="py-4 text-center text-sm text-[var(--muted-foreground)]">{t("detail.noVotes")}</p>
          ) : (
            <div className="space-y-2">
              {(["AVAILABLE", "MAYBE", "UNAVAILABLE"] as const).map(status => {
                const votes = match.votes!.filter(v => v.status === status);
                if (votes.length === 0) return null;
                const color = status === "AVAILABLE" ? "text-green-400" : status === "MAYBE" ? "text-yellow-400" : "text-red-400";
                const bg = status === "AVAILABLE" ? "bg-green-500/10" : status === "MAYBE" ? "bg-yellow-500/10" : "bg-red-500/10";
                const label = status === "AVAILABLE" ? t("detail.available") : status === "MAYBE" ? tc("maybe") : t("detail.unavailable");
                return (
                  <div key={status}>
                    <p className={`mb-1 text-sm font-medium ${color}`}>{label} ({votes.length})</p>
                    <div className="space-y-1">
                      {votes.map(v => (
                        <div key={v.id} className={`flex items-center gap-2 rounded-lg ${bg} px-3 py-2`}>
                          {v.user.avatarUrl ? (
                            <img src={v.user.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
                          ) : (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)]/20 text-xs font-bold text-[var(--primary)]">
                              {v.user.displayName.charAt(0)}
                            </div>
                          )}
                          <span className="text-sm text-[var(--foreground)]">{v.user.displayName}</span>
                          {v.comment && <span className="text-xs text-[var(--muted-foreground)]">— {v.comment}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Player Stats Tab */}
      {tab === "stats" && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">{t("detail.playerStats")}</h2>
            <Button size="sm" onClick={() => setShowAddPlayer(true)}>
              <UserPlus className="h-4 w-4" /> {t("detail.addPlayer")}
            </Button>
          </div>

          {match.playerStats.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--muted-foreground)]">{t("detail.noPlayerStats")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                    <th className="pb-2 pr-4">{t("detail.playersTab")}</th>
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
                          <span className="font-medium text-[var(--foreground)]">{ps.user?.displayName || ps.externalName || tc("unknown")}</span>
                          {ps.externalName && !ps.user && <Badge variant="outline" className="text-xs">{t("detail.external")}</Badge>}
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-center text-[var(--foreground)]">{ps.kills}</td>
                      <td className="py-2 pr-4 text-center text-[var(--foreground)]">{ps.deaths}</td>
                      <td className="py-2 pr-4 text-center text-[var(--foreground)]">{ps.assists}</td>
                      <td className="py-2 pr-4 text-center text-[var(--foreground)]">{ps.headshots}</td>
                      <td className="py-2 pr-4 text-center">
                        <span className={`font-medium ${(ps.kd || 0) >= 1 ? "text-green-400" : "text-red-400"}`}>{ps.kd?.toFixed(2) || "—"}</span>
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
              <h3 className="font-medium text-[var(--foreground)]">{t("detail.addPlayer")}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-[var(--muted-foreground)]">{t("detail.teamMember")}</label>
                  <select
                    value={playerForm.userId}
                    onChange={(e) => setPlayerForm({ ...playerForm, userId: e.target.value, externalName: "" })}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                  >
                    <option value="">{t("detail.externalSub")}</option>
                    {members.map(m => (<option key={m.user.id} value={m.user.id}>{m.user.displayName}</option>))}
                  </select>
                </div>
                {!playerForm.userId && (
                  <Input label={t("detail.externalName")} value={playerForm.externalName} onChange={(e) => setPlayerForm({ ...playerForm, externalName: e.target.value })} placeholder={t("detail.externalNamePlaceholder")} />
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <Input label="Kills" type="number" value={playerForm.kills} onChange={(e) => setPlayerForm({ ...playerForm, kills: e.target.value })} />
                <Input label="Deaths" type="number" value={playerForm.deaths} onChange={(e) => setPlayerForm({ ...playerForm, deaths: e.target.value })} />
                <Input label="Assists" type="number" value={playerForm.assists} onChange={(e) => setPlayerForm({ ...playerForm, assists: e.target.value })} />
                <Input label="Headshots" type="number" value={playerForm.headshots} onChange={(e) => setPlayerForm({ ...playerForm, headshots: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={addPlayerStat} isLoading={submitting}>{t("detail.add")}</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddPlayer(false)}>{tc("cancel")}</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* MOSS Tab */}
      {tab === "moss" && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">{t("detail.mossFiles")}</h2>
          <div className="mb-4 flex items-end gap-3 rounded-lg border border-dashed border-[var(--border)] p-4">
            <Input label={t("detail.playerName")} value={mossPlayerName} onChange={(e) => setMossPlayerName(e.target.value)} placeholder={t("detail.playerNamePlaceholder")} className="flex-1" />
            <div>
              <input type="file" id="moss-upload" className="hidden" onChange={(e) => e.target.files?.[0] && uploadMoss(e.target.files[0])} />
              <Button size="sm" onClick={() => document.getElementById("moss-upload")?.click()} isLoading={uploading}>
                <Upload className="h-4 w-4" /> {t("detail.uploadMoss")}
              </Button>
            </div>
          </div>
          {match.mossFiles.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--muted-foreground)]">{t("detail.noMossFiles")}</p>
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
                  <a href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/moss/${f.id}/download`} className="rounded p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
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
            <h2 className="text-lg font-semibold text-[var(--foreground)]">{t("detail.review")}</h2>
            {reviewExists && (
              <Button size="sm" variant="destructive" onClick={deleteReview}>
                <Trash2 className="h-4 w-4" /> {t("detail.deleteReview")}
              </Button>
            )}
          </div>
          {reviewLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--primary)]" />
            </div>
          ) : (
            <div className="space-y-4">
              <Textarea label={t("detail.positives")} value={reviewForm.positives} onChange={(e) => setReviewForm({ ...reviewForm, positives: e.target.value })} placeholder={t("detail.positivesPlaceholder")} rows={3} />
              <Textarea label={t("detail.negatives")} value={reviewForm.negatives} onChange={(e) => setReviewForm({ ...reviewForm, negatives: e.target.value })} placeholder={t("detail.negativesPlaceholder")} rows={3} />
              <Textarea label={t("detail.improvements")} value={reviewForm.improvements} onChange={(e) => setReviewForm({ ...reviewForm, improvements: e.target.value })} placeholder={t("detail.improvementsPlaceholder")} rows={3} />
              <Textarea label={t("form.notes")} value={reviewForm.notes} onChange={(e) => setReviewForm({ ...reviewForm, notes: e.target.value })} placeholder={t("detail.notesPlaceholder")} rows={3} />
              <div className="flex justify-end pt-2">
                <Button onClick={saveReview} isLoading={reviewSubmitting}>{reviewExists ? t("detail.updateReview") : t("detail.saveReview")}</Button>
              </div>
            </div>
          )}
          <CommentSection entityType="MATCH" entityId={matchId} />
        </Card>
      )}

      {/* Replay Tab */}
      {tab === "replay" && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">{t("detail.replayTitle")}</h2>
          {match.replay ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-[var(--secondary)] p-3">
                <Film className="h-5 w-5 shrink-0 text-[var(--primary)]" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)]">{match.replay.fileName}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {match.replay.parsed ? t("detail.roundsParsed").replace("{count}", String(match.replay.rounds?.length || 0)) : t("detail.parsing")}
                  </p>
                </div>
                <a href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/replays/${match.replay.id}/download`} className="rounded p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
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
              <p className="mb-3 text-sm text-[var(--muted-foreground)]">{t("detail.noReplay")}</p>
              <input type="file" id="replay-upload" accept=".rec,.zip" className="hidden" onChange={(e) => e.target.files?.[0] && uploadReplay(e.target.files[0])} />
              <Button size="sm" onClick={() => document.getElementById("replay-upload")?.click()} isLoading={uploading}>
                <Upload className="h-4 w-4" /> {t("detail.uploadReplay")}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Result Modal */}
      <Modal open={showResultModal} onClose={() => setShowResultModal(false)} title={t("detail.resultTitle")} size="md">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t("form.ourScore")} type="number" value={resultForm.scoreUs} onChange={(e) => setResultForm({ ...resultForm, scoreUs: e.target.value })} />
            <Input label={t("form.opponentScore")} type="number" value={resultForm.scoreThem} onChange={(e) => setResultForm({ ...resultForm, scoreThem: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label={`${t("detail.ratingSkill")} (1-5)`} type="number" min="1" max="5" value={resultForm.skillRating} onChange={(e) => setResultForm({ ...resultForm, skillRating: e.target.value })} />
            <Input label={`${t("detail.ratingCommunication")} (1-5)`} type="number" min="1" max="5" value={resultForm.communicationRating} onChange={(e) => setResultForm({ ...resultForm, communicationRating: e.target.value })} />
            <Input label={`${t("detail.ratingPunctuality")} (1-5)`} type="number" min="1" max="5" value={resultForm.punctualityRating} onChange={(e) => setResultForm({ ...resultForm, punctualityRating: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowResultModal(false)}>{tc("cancel")}</Button>
            <Button onClick={handleResultSubmit} isLoading={resultSubmitting}>{tc("save")}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
