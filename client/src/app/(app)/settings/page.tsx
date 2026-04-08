"use client";
import { useEffect, useState, useCallback } from "react";
import { Settings, Shield, User, Save, Upload, Trash2, Bell, Globe } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useAuthStore } from "@/lib/auth-store";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Textarea } from "@/components/ui/Input";
import { useRouter } from "next/navigation";
import { useT, useI18n } from "@/i18n/provider";
import { locales, localeNames, type Locale } from "@/i18n";

interface TeamSettings {
  id: string;
  name: string;
  tag: string;
  description?: string;
  logoUrl?: string;
  discordWebhookUrl?: string;
  defaultTimezone?: string;
  notificationChannel?: string;
}

interface NotificationConfig {
  email: boolean;
  whatsapp: boolean;
}

interface MemberData {
  id: string;
  role: string;
  status: string;
  joinedAt: string;
  user: {
    id: string;
    numericId: number;
    username: string;
    displayName: string;
    avatarUrl?: string;
    isAdmin: boolean;
    r6Username?: string;
    email?: string;
  };
}

export default function SettingsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const { success, error } = useToast();
  const t = useT("settings");
  const tc = useT("common");
  const tl = useT("language");
  const { locale, setLocale } = useI18n();
  const [tab, setTab] = useState<"personal" | "team" | "notifications" | "members">("personal");
  const [teamSettings, setTeamSettings] = useState<TeamSettings | null>(null);
  const [members, setMembers] = useState<MemberData[]>([]);
  const [notifyConfig, setNotifyConfig] = useState<NotificationConfig>({ email: false, whatsapp: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: "", tag: "", description: "", discordWebhookUrl: "" });
  const [notificationChannel, setNotificationChannel] = useState("NONE");
  const [personalForm, setPersonalForm] = useState({ displayName: "", email: "", phone: "" });

  // Nur Admins dürfen hier rein
  useEffect(() => {
    if (!loading && user && !user.isAdmin) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  const load = useCallback(async () => {
    try {
      const [teamRes, membersRes, notifyRes] = await Promise.allSettled([
        api.get<TeamSettings>("/api/team"),
        api.get<MemberData[]>("/api/team/members"),
        api.get<NotificationConfig>("/api/team/notification-config"),
      ]);
      if (teamRes.status === "fulfilled" && teamRes.value.data) {
        const ts = teamRes.value.data;
        setTeamSettings(ts);
        setTeamForm({ name: ts.name, tag: ts.tag, description: ts.description || "", discordWebhookUrl: ts.discordWebhookUrl || "" });
        setNotificationChannel(ts.notificationChannel || "NONE");
      }
      if (membersRes.status === "fulfilled" && membersRes.value.data) {
        setMembers(membersRes.value.data);
      }
      if (notifyRes.status === "fulfilled" && notifyRes.value.data) {
        setNotifyConfig(notifyRes.value.data);
      }
      if (user) {
        setPersonalForm({ displayName: user.displayName, email: user.email || "", phone: (user as any).phone || "" });
      }
    } catch {
      error(tc("loadError"));
    } finally {
      setLoading(false);
    }
  }, [user, error]);

  useEffect(() => { load(); }, [load]);

  const saveTeam = async () => {
    setSaving(true);
    try {
      await api.put("/api/team", teamForm);
      success(tc("saved"));
      load();
    } catch {
      error(tc("saveError"));
    } finally {
      setSaving(false);
    }
  };

  const savePersonal = async () => {
    setSaving(true);
    try {
      await api.put("/api/users/me", { ...personalForm, phone: personalForm.phone || null });
      success(tc("saved"));
    } catch {
      error(tc("saveError"));
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (userId: string) => {
    if (!confirm(t("members.confirmRemove"))) return;
    try {
      await api.delete(`/api/team/members/${userId}`);
      success(tc("deleted"));
      load();
    } catch {
      error(tc("deleteError"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--primary)]" />
      </div>
    );
  }

  if (!user?.isAdmin) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">{t("title")}</h1>
        <p className="text-[var(--muted-foreground)]">{t("subtitle")}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-[var(--secondary)] p-1">
        {[
          { id: "personal" as const, label: t("tabs.personal"), icon: User },
          { id: "team" as const, label: t("tabs.team"), icon: Settings },
          { id: "notifications" as const, label: t("tabs.notifications"), icon: Bell },
          { id: "members" as const, label: t("tabs.members"), icon: Shield },
        ].map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${tab === tb.id ? "bg-[var(--primary)] text-white" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
          >
            <tb.icon className="h-4 w-4" /> {tb.label}
          </button>
        ))}
      </div>

      {/* Personal Settings */}
      {tab === "personal" && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">{t("personal.title")}</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="h-16 w-16 rounded-full ring-2 ring-[var(--border)]" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary)] text-xl font-bold text-white">
                  {user?.displayName?.charAt(0)}
                </div>
              )}
              <div>
                <p className="font-semibold text-[var(--foreground)]">{user?.displayName}</p>
                <p className="text-sm text-[var(--muted-foreground)]">@{user?.username}</p>
              </div>
            </div>
            <Input label={t("personal.displayName")} value={personalForm.displayName} onChange={(e) => setPersonalForm({ ...personalForm, displayName: e.target.value })} />
            <Input label={t("personal.email")} type="email" value={personalForm.email} onChange={(e) => setPersonalForm({ ...personalForm, email: e.target.value })} />
            <Input label={t("personal.phone")} value={personalForm.phone} onChange={(e) => setPersonalForm({ ...personalForm, phone: e.target.value })} placeholder="+491234567890" />

            {/* Language Switcher */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                <Globe className="mr-1.5 inline h-4 w-4" />
                {t("personal.language")}
              </label>
              <div className="flex gap-2">
                {locales.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLocale(l)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                      locale === l
                        ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                        : "border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/50 hover:text-[var(--foreground)]"
                    }`}
                  >
                    {localeNames[l]}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={savePersonal} isLoading={saving}>
              <Save className="h-4 w-4" /> {tc("save")}
            </Button>
          </div>
        </Card>
      )}

      {/* Team Settings */}
      {tab === "team" && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">{t("team.title")}</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {teamSettings?.logoUrl ? (
                <img src={teamSettings.logoUrl} alt="" className="h-16 w-16 rounded-lg" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-[var(--secondary)]">
                  <Settings className="h-8 w-8 text-[var(--muted-foreground)]" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)]">{t("team.teamLogo")}</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const form = new FormData();
                      form.append("file", file);
                      api.upload("/api/team/logo", file).then(() => load());
                    }
                  }}
                  className="mt-1 text-sm text-[var(--muted-foreground)] file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--primary)] file:px-3 file:py-1.5 file:text-sm file:text-white"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label={t("team.teamName")} value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} />
              <Input label={t("team.teamTag")} value={teamForm.tag} onChange={(e) => setTeamForm({ ...teamForm, tag: e.target.value })} placeholder={t("team.teamTagPlaceholder")} />
            </div>
            <Textarea label={t("team.description")} value={teamForm.description} onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })} />
            <Input label={t("team.webhookUrl")} value={teamForm.discordWebhookUrl} onChange={(e) => setTeamForm({ ...teamForm, discordWebhookUrl: e.target.value })} placeholder={t("team.webhookPlaceholder")} />
            <Button onClick={saveTeam} isLoading={saving}>
              <Save className="h-4 w-4" /> {tc("save")}
            </Button>
          </div>
        </Card>
      )}

      {/* Notification Channel */}
      {tab === "notifications" && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">{t("notifications.title")}</h2>
          <p className="mb-4 text-sm text-[var(--muted-foreground)]">
            {t("notifications.description")}
          </p>
          <div className="space-y-3">
            {([
              { value: "NONE", label: t("notifications.off"), desc: t("notifications.offDesc"), available: true },
              { value: "EMAIL", label: t("notifications.email"), desc: t("notifications.emailDesc"), available: notifyConfig.email },
              { value: "WHATSAPP", label: t("notifications.whatsapp"), desc: t("notifications.whatsappDesc"), available: notifyConfig.whatsapp },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                disabled={!opt.available}
                onClick={() => setNotificationChannel(opt.value)}
                className={`w-full rounded-lg border p-4 text-left transition-all ${
                  notificationChannel === opt.value
                    ? "border-[var(--primary)] bg-[var(--primary)]/10"
                    : opt.available
                      ? "border-[var(--border)] bg-[var(--secondary)] hover:border-[var(--primary)]/50"
                      : "border-[var(--border)] bg-[var(--secondary)] opacity-40 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-[var(--foreground)]">{opt.label}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{opt.desc}</p>
                  </div>
                  {!opt.available && (
                    <Badge variant="outline">{tc("notConfigured")}</Badge>
                  )}
                  {notificationChannel === opt.value && opt.available && (
                    <div className="h-3 w-3 rounded-full bg-[var(--primary)]" />
                  )}
                </div>
              </button>
            ))}
          </div>
          <div className="mt-4">
            <Button onClick={async () => {
              setSaving(true);
              try {
                await api.put("/api/team", { notificationChannel });
                success(tc("saved"));
              } catch { error(tc("saveError")); }
              finally { setSaving(false); }
            }} isLoading={saving}>
              <Save className="h-4 w-4" /> {tc("save")}
            </Button>
          </div>
        </Card>
      )}

      {/* Members Management */}
      {tab === "members" && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">{t("members.title")} ({members.length})</h2>
          {members.length === 0 ? (
            <p className="text-[var(--muted-foreground)]">{t("members.empty")}</p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-lg bg-[var(--secondary)] p-3">
                  {m.user.avatarUrl ? (
                    <img src={m.user.avatarUrl} alt="" className="h-10 w-10 rounded-full" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)]/20 text-sm font-bold text-[var(--primary)]">
                      {m.user.displayName.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--foreground)]">{m.user.displayName}</span>
                      {m.user.isAdmin && <Badge variant="default">Admin</Badge>}
                      <Badge variant="outline">{m.role}</Badge>
                      <Badge variant="outline">{m.status}</Badge>
                    </div>
                    <span className="text-xs text-[var(--muted-foreground)]">@{m.user.username}</span>
                  </div>
                  {m.user.id !== user?.id && (
                    <button onClick={() => removeMember(m.user.id)} className="rounded p-1.5 text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
