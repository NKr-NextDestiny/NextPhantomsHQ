"use client";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ToastProvider } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { I18nProvider, useT } from "@/i18n/provider";
import { useBrowserNotifications, shouldPromptNotifications } from "@/hooks/useBrowserNotifications";
import { useSocket } from "@/hooks/useSocket";

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

function NotificationPermissionRequest() {
  const { requestPermission } = useBrowserNotifications();
  useEffect(() => {
    const timer = setTimeout(() => {
      if (shouldPromptNotifications()) {
        void requestPermission();
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [requestPermission]);

  return null;
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
      <NotificationPermissionRequest />
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
