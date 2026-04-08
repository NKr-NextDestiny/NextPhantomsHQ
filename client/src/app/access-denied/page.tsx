"use client";
import { useSearchParams } from "next/navigation";
import { ShieldX } from "lucide-react";
import { Suspense } from "react";

function AccessDeniedContent() {
  const params = useSearchParams();
  const reason = params.get("reason");

  const reasonMessages: Record<string, string> = {
    login_failed: "Die Anmeldung bei Discord ist fehlgeschlagen. Versuche es erneut.",
    not_in_server: "Du bist nicht auf dem erforderlichen Discord-Server.",
    missing_role: "Dir fehlt die benötigte Discord-Rolle für den Zugriff.",
    not_member: "Du bist kein Mitglied dieses Teams.",
    banned: "Du wurdest vom Team ausgeschlossen.",
    inactive: "Dein Account wurde deaktiviert.",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center shadow-2xl">
        <ShieldX className="mx-auto mb-4 h-16 w-16 text-[var(--destructive)]" />
        <h1 className="mb-2 text-2xl font-bold text-[var(--foreground)]">Zugriff verweigert</h1>
        <p className="mb-6 text-[var(--muted-foreground)]">
          {reason && reasonMessages[reason]
            ? reasonMessages[reason]
            : "Du hast keinen Zugriff auf diese Seite."}
        </p>
        <a
          href="/auth/login"
          className="inline-flex rounded-lg bg-[var(--primary)] px-6 py-3 font-semibold text-white transition-all hover:bg-orange-600"
        >
          Zurück zum Login
        </a>
      </div>
    </div>
  );
}

export default function AccessDeniedPage() {
  return (
    <Suspense>
      <AccessDeniedContent />
    </Suspense>
  );
}
