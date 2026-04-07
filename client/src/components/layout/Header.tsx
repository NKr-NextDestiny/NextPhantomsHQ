"use client";
import { Bell, LogOut } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

export function Header() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // ignore
    }
    logout();
    router.push("/auth/login");
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[var(--card)]/80 px-6 backdrop-blur-md">
      <div className="lg:hidden w-10" />
      <div className="hidden lg:block" />

      <div className="flex items-center gap-4">
        <button className="relative rounded-lg p-2 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]">
          <Bell className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="h-8 w-8 rounded-full object-cover ring-2 ring-[var(--border)]"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-bold text-white">
              {user?.displayName?.charAt(0) ?? "?"}
            </div>
          )}
          <span className="hidden text-sm font-medium text-[var(--foreground)] sm:block">
            {user?.displayName}
          </span>
        </div>

        <button
          onClick={handleLogout}
          className="rounded-lg p-2 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--destructive)]"
          title="Abmelden"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
