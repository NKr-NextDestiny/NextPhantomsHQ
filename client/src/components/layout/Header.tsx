"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { Bell, LogOut, Check, Globe, Save, Monitor } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";
import { useT, useI18n } from "@/i18n/provider";
import { locales, localeNames, type Locale } from "@/i18n";
import { useBrowserNotifications } from "@/hooks/useBrowserNotifications";

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

function ProfileDropdown({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ displayName: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { success, error } = useToast();
  const t = useT("header");
  const tp = useT("settings");
  const tc = useT("common");
  const { locale, setLocale } = useI18n();
  const { supported, permission, enabled, requestPermission, enable, disable } = useBrowserNotifications();

  useEffect(() => {
    if (user && open) {
      setForm({ displayName: user.displayName || "", email: user.email || "", phone: user.phone || "" });
    }
  }, [user, open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.put("/api/users/me", { ...form, phone: form.phone || null });
      success(tc("saved"));
    } catch {
      error(tc("saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((p) => !p)} className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-[var(--secondary)]">
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.displayName} className="h-8 w-8 rounded-full object-cover ring-2 ring-[var(--border)]" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-bold text-white">
            {user?.displayName?.charAt(0) ?? "?"}
          </div>
        )}
        <span className="hidden text-sm font-medium text-[var(--foreground)] sm:block">{user?.displayName}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl" style={{ zIndex: 50 }}>
          {/* Profile header */}
          <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-10 w-10 rounded-full ring-2 ring-[var(--border)]" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-bold text-white">{user?.displayName?.charAt(0)}</div>
            )}
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">{user?.displayName}</p>
              <p className="text-xs text-[var(--muted-foreground)]">@{user?.username}</p>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto px-4 py-3 space-y-3">
            {/* Display name */}
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">{tp("personal.displayName")}</label>
              <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none" />
            </div>
            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">{tp("personal.email")}</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none" />
            </div>
            {/* Phone */}
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">{tp("personal.phone")}</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+491234567890" className="w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none" />
            </div>

            {/* Save button */}
            <button onClick={saveProfile} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--primary)]/90 disabled:opacity-50">
              <Save className="h-3.5 w-3.5" /> {saving ? tc("saving") : tc("save")}
            </button>

            {/* Language */}
            <div className="border-t border-[var(--border)] pt-3">
              <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)] mb-2">
                <Globe className="h-3.5 w-3.5" /> {tp("personal.language")}
              </label>
              <div className="flex gap-1.5">
                {locales.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLocale(l)}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-all ${
                      locale === l
                        ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                        : "border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/50"
                    }`}
                  >
                    {localeNames[l]}
                  </button>
                ))}
              </div>
            </div>

            {/* Browser notifications toggle */}
            {supported && permission !== "denied" && (
              <div className="border-t border-[var(--border)] pt-3">
                <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)] mb-2">
                  <Monitor className="h-3.5 w-3.5" /> {tp("notifications.browser")}
                </label>
                {permission === "granted" ? (
                  <button
                    onClick={() => enabled ? disable() : enable()}
                    className="flex w-full items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-2.5 text-left text-sm transition-all hover:border-[var(--primary)]/50"
                  >
                    <div className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${enabled ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`}>
                      <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                    </div>
                    <span className="text-xs text-[var(--foreground)]">{enabled ? tp("notifications.browserEnabled") : tp("notifications.browserDisabled")}</span>
                  </button>
                ) : (
                  <button onClick={requestPermission} className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:border-[var(--primary)]/50">
                    <Bell className="h-3.5 w-3.5" /> {tp("notifications.browserAllow")}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Logout */}
          <div className="border-t border-[var(--border)] p-2">
            <button onClick={onLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--destructive)] transition-colors hover:bg-[var(--secondary)]">
              <LogOut className="h-4 w-4" /> {t("logout")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
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

        {/* Profile dropdown */}
        <ProfileDropdown user={user} onLogout={handleLogout} />
      </div>
    </header>
  );
}
