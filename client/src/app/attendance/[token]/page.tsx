"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle, XCircle, HelpCircle, Calendar, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface EventInfo {
  title: string;
  type: string;
  date: string;
  duration?: number;
  description?: string;
  canUpdate?: boolean;
  currentReason?: string | null;
}

type Status = "loading" | "ready" | "submitting" | "success" | "error" | "already_voted";

export default function AttendancePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params.token as string;
  const requestedVote = searchParams.get("vote");
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [votedAs, setVotedAs] = useState("");
  const [reason, setReason] = useState("");
  const autoSubmittedRef = useRef(false);

  const handleVote = async (vote: string) => {
    setStatus("submitting");
    try {
      const res = await fetch(`${API_URL}/api/attendance/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote, reason: reason || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Fehler beim Abstimmen.");
        setStatus("error");
        return;
      }
      setVotedAs(vote);
      setStatus("success");
    } catch {
      setErrorMsg("Fehler beim Abstimmen.");
      setStatus("error");
    }
  };

  useEffect(() => {
    async function loadEvent() {
      try {
        const res = await fetch(`${API_URL}/api/attendance/${token}`);
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || "Ungueltiger oder abgelaufener Link.");
          setStatus("error");
          return;
        }

        const alreadyResponded = Boolean(data.data?.alreadyResponded);
        const canUpdate = Boolean(data.data?.canUpdate);
        const normalizedVote = requestedVote?.toUpperCase();
        const canAutoSubmit =
          normalizedVote === "AVAILABLE" || normalizedVote === "UNAVAILABLE" || normalizedVote === "MAYBE";

        setEvent({
          title: data.data.eventTitle,
          type: data.data.eventType,
          date: data.data.eventDate,
          canUpdate,
          currentReason: data.data.currentReason,
        });

        if (alreadyResponded) {
          setVotedAs(data.data.currentResponse);
          setReason(data.data.currentReason || "");
        }

        if (canAutoSubmit && !autoSubmittedRef.current && (!alreadyResponded || canUpdate)) {
          autoSubmittedRef.current = true;
          await handleVote(normalizedVote);
          return;
        }

        setStatus(alreadyResponded ? (canUpdate ? "ready" : "already_voted") : "ready");
      } catch {
        setErrorMsg("Fehler beim Laden.");
        setStatus("error");
      }
    }

    void loadEvent();
  }, [token, requestedVote]);

  const voteLabel = (vote: string) => {
    const upper = vote.toUpperCase();
    if (upper === "AVAILABLE") return "Verfuegbar";
    if (upper === "UNAVAILABLE") return "Nicht verfuegbar";
    return "Vielleicht";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-2xl">
        <img src="/images/logo_icon.png" alt="Next Phantoms HQ" className="mx-auto mb-4 h-12 w-12" />
        <h1 className="mb-6 text-center text-xl font-bold text-[var(--primary)]">Next Phantoms HQ</h1>

        {status === "loading" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
            <p className="text-sm text-[var(--muted-foreground)]">Laden...</p>
          </div>
        )}

        {status === "error" && (
          <div className="rounded-lg bg-red-500/10 p-4 text-center">
            <XCircle className="mx-auto mb-2 h-8 w-8 text-red-400" />
            <p className="text-sm text-red-400">{errorMsg}</p>
          </div>
        )}

        {(status === "ready" || status === "submitting") && event && (
          <>
            <div className="mb-6 rounded-lg bg-[var(--secondary)] p-4">
              <h2 className="font-semibold text-[var(--foreground)]">{event.title}</h2>
              <div className="mt-2 flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                <Calendar className="h-4 w-4" />
                {formatDate(event.date)}
                {event.duration && <span>({event.duration} Min)</span>}
              </div>
              {event.description && <p className="mt-2 text-sm text-[var(--muted-foreground)]">{event.description}</p>}
            </div>

            <p className="mb-4 text-center text-sm text-[var(--muted-foreground)]">Bist du dabei?</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optionaler Grund oder Kommentar..."
              className="mb-4 min-h-[88px] w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none"
            />
            {votedAs && event.canUpdate && (
              <p className="mb-4 text-center text-xs text-[var(--muted-foreground)]">
                Bereits abgestimmt als <strong className="text-[var(--foreground)]">{voteLabel(votedAs)}</strong>. Du kannst deine Antwort bis zum Ablauf dieses WhatsApp-Links aktualisieren.
              </p>
            )}

            <div className="space-y-3">
              <button
                onClick={() => handleVote("AVAILABLE")}
                disabled={status === "submitting"}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-500/20 py-3 font-semibold text-green-400 transition-all hover:bg-green-500/30 disabled:opacity-50"
              >
                <CheckCircle className="h-5 w-5" /> Verfuegbar
              </button>
              <button
                onClick={() => handleVote("MAYBE")}
                disabled={status === "submitting"}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-500/20 py-3 font-semibold text-yellow-400 transition-all hover:bg-yellow-500/30 disabled:opacity-50"
              >
                <HelpCircle className="h-5 w-5" /> Vielleicht
              </button>
              <button
                onClick={() => handleVote("UNAVAILABLE")}
                disabled={status === "submitting"}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-500/20 py-3 font-semibold text-red-400 transition-all hover:bg-red-500/30 disabled:opacity-50"
              >
                <XCircle className="h-5 w-5" /> Nicht verfuegbar
              </button>
            </div>
          </>
        )}

        {(status === "success" || status === "already_voted") && (
          <div className="text-center">
            <CheckCircle className="mx-auto mb-3 h-12 w-12 text-green-400" />
            <h2 className="mb-2 text-lg font-semibold text-[var(--foreground)]">
              {status === "already_voted" ? "Bereits abgestimmt" : "Abstimmung gespeichert!"}
            </h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Deine Antwort: <strong className="text-[var(--foreground)]">{voteLabel(votedAs)}</strong>
            </p>
            {reason && (
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                Kommentar: <strong className="text-[var(--foreground)]">{reason}</strong>
              </p>
            )}
            {event && (
              <div className="mt-4 rounded-lg bg-[var(--secondary)] p-3 text-sm text-[var(--muted-foreground)]">
                {event.title} - {formatDate(event.date)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
