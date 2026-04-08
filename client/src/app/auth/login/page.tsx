"use client";
import { I18nProvider, useT } from "@/i18n/provider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function LoginContent() {
  const t = useT("auth");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center shadow-2xl">
        <img src="/images/logo_nde.png" alt="Next Destiny" className="mx-auto mb-6 h-24 w-auto" />
        <h1 className="mb-2 text-3xl font-bold text-[var(--primary)]">Next Phantoms HQ</h1>
        <p className="mb-8 text-[var(--muted-foreground)]">Team Management Platform</p>
        <a
          href={`${API_URL}/api/auth/discord`}
          className="inline-flex items-center gap-3 rounded-lg bg-[#5865F2] px-6 py-3 text-lg font-semibold text-white transition-all hover:bg-[#4752C4] hover:shadow-lg"
        >
          <svg width="24" height="24" viewBox="0 0 127.14 96.36" fill="currentColor">
            <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
          </svg>
          {t("loginWith")}
        </a>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <I18nProvider>
      <LoginContent />
    </I18nProvider>
  );
}
