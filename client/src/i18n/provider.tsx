"use client";
import { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { type Locale, locales, createT, detectLocale } from "./index";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
  /** Get a namespace-scoped translator */
  scopedT: (namespace: string) => (key: string, values?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();

  const [locale, setLocaleState] = useState<Locale>(() => {
    // Check localStorage first for immediate display
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("locale") as Locale;
      if (stored && locales.includes(stored)) return stored;
    }
    return "de";
  });

  // Sync locale from user profile when it loads
  useEffect(() => {
    if (user) {
      const userLang = (user as any).language as Locale;
      if (userLang && locales.includes(userLang)) {
        setLocaleState(userLang);
        localStorage.setItem("locale", userLang);
      }
    } else {
      // Not logged in: use browser language if no stored preference
      const stored = localStorage.getItem("locale");
      if (!stored) {
        const detected = detectLocale();
        setLocaleState(detected);
      }
    }
  }, [user]);

  const setLocale = useCallback(async (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("locale", newLocale);
    // Persist to user profile if logged in
    if (user) {
      try {
        await api.put("/api/users/me", { language: newLocale });
      } catch {
        // ignore
      }
    }
  }, [user]);

  const t = useMemo(() => createT(locale), [locale]);
  const scopedT = useCallback(
    (namespace: string) => createT(locale, namespace),
    [locale],
  );

  // Keep <html lang="..."> in sync
  useEffect(() => {
    document.documentElement.lang = locale === "pirate" ? "de" : locale;
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t, scopedT }), [locale, setLocale, t, scopedT]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

/** Shorthand hook: useT("dashboard") returns a scoped t function */
export function useT(namespace?: string) {
  const { scopedT, t } = useI18n();
  return useMemo(() => (namespace ? scopedT(namespace) : t), [namespace, scopedT, t]);
}
