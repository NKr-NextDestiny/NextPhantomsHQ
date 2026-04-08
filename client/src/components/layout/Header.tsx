"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { Bell, LogOut, Check } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";
import { useT } from "@/i18n/provider";

interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  link?: string | null;
  createdAt: string;
  actor?: {
    displayName: string;
    avatarUrl?: string | null;
  } | null;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

export function Header() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const { error } = useToast();
  const t = useT("header");

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch unread count on mount and periodically
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get<NotificationsResponse>(
        "/api/notifications?unreadOnly=false&limit=10",
      );
      if (res.data) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unreadCount);
      }
    } catch {
      // silently ignore — don't spam toasts on background polls
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleBellClick = () => {
    setOpen((prev) => !prev);
  };

  const handleMarkRead = async (notification: Notification) => {
    if (!notification.isRead) {
      try {
        await api.put(`/api/notifications/${notification.id}/read`);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        error(t("markReadError"));
      }
    }
    if (notification.link) {
      setOpen(false);
      router.push(notification.link);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    setLoading(true);
    try {
      await api.put("/api/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      error(t("markAllReadError"));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // Logout proceeds regardless of API failure
    }
    logout();
    router.push("/auth/login");
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[var(--card)]/80 px-6 backdrop-blur-md">
      <div className="lg:hidden w-10" />
      <div className="hidden lg:block" />

      <div className="flex items-center gap-4">
        {/* Notifications bell */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={handleBellClick}
            className="relative rounded-lg p-2 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
            aria-label={t("notifications")}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold leading-none text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div
              className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl"
              style={{ zIndex: 50 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                <span className="text-sm font-semibold text-[var(--foreground)]">
                  {t("notifications")}
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    disabled={loading}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)] disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" />
                    {t("markAllRead")}
                  </button>
                )}
              </div>

              {/* Notification list */}
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
                    {t("noNotifications")}
                  </p>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleMarkRead(n)}
                      className={[
                        "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--secondary)]",
                        !n.isRead ? "border-l-2 border-[var(--primary)]" : "border-l-2 border-transparent",
                      ].join(" ")}
                    >
                      {/* Actor avatar / initial */}
                      <div className="mt-0.5 shrink-0">
                        {n.actor?.avatarUrl ? (
                          <img
                            src={n.actor.avatarUrl}
                            alt={n.actor.displayName}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-bold text-white">
                            {n.actor?.displayName?.charAt(0) ?? "?"}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <p
                          className={[
                            "truncate text-sm font-medium",
                            !n.isRead
                              ? "text-[var(--foreground)]"
                              : "text-[var(--muted-foreground)]",
                          ].join(" ")}
                        >
                          {n.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-[var(--muted-foreground)]">
                          {n.message}
                        </p>
                        <p className="mt-1 text-[10px] text-[var(--muted-foreground)]/70">
                          {formatDate(n.createdAt)}
                        </p>
                      </div>

                      {/* Unread dot */}
                      {!n.isRead && (
                        <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User info */}
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
          title={t("logout")}
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
