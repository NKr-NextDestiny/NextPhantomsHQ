"use client";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ToastProvider } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { I18nProvider, useT } from "@/i18n/provider";
import { useBrowserNotifications, shouldPromptNotifications } from "@/hooks/useBrowserNotifications";
import { useSocket } from "@/hooks/useSocket";
import { Bell, X } from "lucide-react";

function BrowserNotificationListener() {
  const { showNotification } = useBrowserNotifications();
  const { on } = useSocket();

  useEffect(() => {
    const events = [
      "training:created", "training:updated",
      "match:created", "match:updated",
      "announcement:created",
    ];
    const cleanups = events.map((event) =>
      on(event, (data: any) => {
        if (!data) return;
        const title = data.title || data.opponent || event;
        const body = data.message || data.notes || "";
        const link = data.link;
        showNotification(title, { body, tag: event, link });
      }),
    );
    return () => cleanups.forEach((fn) => fn());
  }, [on, showNotification]);

  return null;
}

function NotificationPrompt() {
  const t = useT("common");
  const { requestPermission } = useBrowserNotifications();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Small delay so it doesn't flash immediately on load
    const timer = setTimeout(() => {
      if (shouldPromptNotifications()) setShow(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  const accept = async () => {
    await requestPermission();
    setShow(false);
  };
  const dismiss = () => {
    localStorage.setItem("browser-notifications-enabled", "false");
    setShow(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-xl">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
        <Bell className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-[var(--foreground)]">{t("browserNotifications.title")}</p>
        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{t("browserNotifications.description")}</p>
        <div className="mt-2 flex gap-2">
          <button onClick={accept} className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--primary)]/90">
            {t("browserNotifications.enable")}
          </button>
          <button onClick={dismiss} className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--secondary)]">
            {t("browserNotifications.dismiss")}
          </button>
        </div>
      </div>
      <button onClick={dismiss} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const t = useT("common");

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--primary)]" />
          <p className="text-sm text-[var(--muted-foreground)]">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Sidebar />
      <div className="lg:pl-64">
        <Header />
        <main className="p-6"><ErrorBoundary>{children}</ErrorBoundary></main>
      </div>
      <BrowserNotificationListener />
      <NotificationPrompt />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <ToastProvider>
        <AppLayoutInner>{children}</AppLayoutInner>
      </ToastProvider>
    </I18nProvider>
  );
}
