"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle, XCircle, HelpCircle, Calendar, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface EventInfo {
  title: string;
  type: string;
  date: string;
  duration?: number;
  description?: string;
}

type Status = "loading" | "ready" | "submitting" | "success" | "error" | "already_voted";

export default function AttendancePage() {
  const params = useParams();
  const token = params.token as string;
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [votedAs, setVotedAs] = useState("");

  useEffect(() => {
    async function loadEvent() {
      try {
        const res = await fetch(`${API_URL}/api/attendance/${token}`);
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || "Ungültiger oder abgelaufener Link.");
          setStatus("error");
          return;
        }
        setEvent(data.data);
        if (data.data?.alreadyVoted) {
          setVotedAs(data.data.vote);
          setStatus("already_voted");
        } else {
          setStatus("ready");
        }
      } catch {
        setErrorMsg("Fehler beim Laden.");
        setStatus("error");
      }
    }
    loadEvent();
  }, [token]);

  const handleVote = async (vote: string) => {
    setStatus("submitting");
    try {
      const res = await fetch(`${API_URL}/api/attendance/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote }),
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

  const voteLabel = (v: string) => {
    if (v === "available") return "Verfügbar";
    if (v === "unavailable") return "Nicht verfügbar";
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
              {event.description && (
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">{event.description}</p>
              )}
            </div>

            <p className="mb-4 text-center text-sm text-[var(--muted-foreground)]">Bist du dabei?</p>

            <div className="space-y-3">
              <button
                onClick={() => handleVote("available")}
                disabled={status === "submitting"}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-500/20 py-3 font-semibold text-green-400 transition-all hover:bg-green-500/30 disabled:opacity-50"
              >
                <CheckCircle className="h-5 w-5" /> Verfügbar
              </button>
              <button
                onClick={() => handleVote("maybe")}
                disabled={status === "submitting"}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-500/20 py-3 font-semibold text-yellow-400 transition-all hover:bg-yellow-500/30 disabled:opacity-50"
              >
                <HelpCircle className="h-5 w-5" /> Vielleicht
              </button>
              <button
                onClick={() => handleVote("unavailable")}
                disabled={status === "submitting"}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-500/20 py-3 font-semibold text-red-400 transition-all hover:bg-red-500/30 disabled:opacity-50"
              >
                <XCircle className="h-5 w-5" /> Nicht verfügbar
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
