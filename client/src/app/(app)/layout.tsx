"use client";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ToastProvider } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { I18nProvider, useT } from "@/i18n/provider";

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
