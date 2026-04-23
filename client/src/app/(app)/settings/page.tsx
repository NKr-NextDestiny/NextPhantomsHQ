"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { Settings, Shield, Save, Trash2, Bell, Monitor, Gamepad2, Plus, X, Download, RefreshCw, QrCode, Send, Bot, MessageSquare } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useAuthStore } from "@/lib/auth-store";
import { useBrowserNotifications } from "@/hooks/useBrowserNotifications";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/i18n/provider";
import QRCode from "qrcode";

interface TeamSettings {
  id: string;
  name: string;
  tag: string;
  description?: string;
  logoUrl?: string;
  discordWebhookUrl?: string;
  defaultTimezone?: string;
  emailNotificationsEnabled?: boolean;
  whatsappNotificationsEnabled?: boolean;
  whatsappGroupJid?: string | null;
  announcementNotificationMode?: "TEXT" | "IMAGE" | "BOTH";
  matchResultNotificationMode?: "TEXT" | "IMAGE" | "BOTH";
  pollResultNotificationMode?: "TEXT" | "IMAGE" | "BOTH";
}

interface NotificationConfig {
  email: boolean;
  whatsapp: boolean;
}

interface GameConfig {
  maps: string[];
  characters: string[];
  characterLabel: string;
  playerRoles: string[];
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
    phone?: string;
    emailNotifications?: boolean;
  };
}

interface EvolutionInstance {
  instance?: {
    instanceName?: string;
    owner?: string;
    profileName?: string;
    status?: string;
  };
}

interface EvolutionStatus {
  configured: boolean;
  apiUrl?: string;
  instance?: string;
  attendanceInstance?: string;
  groupJid?: string | null;
  instances: EvolutionInstance[];
}

interface EvolutionGroup {
  id: string;
  subject?: string;
  desc?: string | null;
  size?: number;
}

interface DescriptionBlock {
  id: string;
  content: string;
  position: "ABOVE" | "BELOW";
  sortOrder: number;
}

interface CommandInfo {
  command: string;
  description: string;
}

function BrowserNotificationSettings() {
  const t = useT("settings");
  const { supported, permission, enabled, requestPermission, enable, disable } = useBrowserNotifications();

  if (!supported) return null;

  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <Monitor className="h-5 w-5 text-[var(--primary)]" />
        <h2 className="text-lg font-semibold text-[var(--foreground)]">{t("notifications.browser")}</h2>
      </div>
      <p className="mb-4 text-sm text-[var(--muted-foreground)]">
        {t("notifications.browserDesc")}
      </p>
      {permission === "denied" ? (
        <p className="text-sm text-[var(--destructive)]">{t("notifications.browserDenied")}</p>
      ) : permission === "granted" ? (
        <button
          onClick={() => enabled ? disable() : enable()}
          className={`flex items-center gap-3 w-full rounded-lg border p-4 text-left transition-all ${
            enabled
              ? "border-[var(--primary)] bg-[var(--primary)]/10"
              : "border-[var(--border)] bg-[var(--secondary)] hover:border-[var(--primary)]/50"
          }`}
        >
          <div className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`}>
            <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
          </div>
          <span className="text-sm font-medium text-[var(--foreground)]">
            {enabled ? t("notifications.browserEnabled") : t("notifications.browserDisabled")}
          </span>
        </button>
      ) : (
        <Button onClick={requestPermission}>
          <Bell className="h-4 w-4" /> {t("notifications.browserAllow")}
        </Button>
      )}
    </Card>
  );
}

export default function SettingsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success, error } = useToast();
  const t = useT("settings");
  const tc = useT("common");

  const validTabs = ["team", "game", "notifications", "members"] as const;
  type Tab = typeof validTabs[number];
  const initialTab = validTabs.includes(searchParams.get("tab") as Tab) ? (searchParams.get("tab") as Tab) : "team";
  const [tab, setTabState] = useState<Tab>(initialTab);
  const setTab = (t: Tab) => {
    setTabState(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    window.history.replaceState({}, "", url.toString());
  };

  const [teamSettings, setTeamSettings] = useState<TeamSettings | null>(null);
  const [members, setMembers] = useState<MemberData[]>([]);
  const [notifyConfig, setNotifyConfig] = useState<NotificationConfig>({ email: false, whatsapp: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: "", tag: "", description: "", discordWebhookUrl: "" });
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true);
  const [whatsappNotificationsEnabled, setWhatsappNotificationsEnabled] = useState(false);
  const [whatsappGroupJid, setWhatsappGroupJid] = useState("");
  const [announcementNotificationMode, setAnnouncementNotificationMode] = useState<"TEXT" | "IMAGE" | "BOTH">("TEXT");
  const [matchResultNotificationMode, setMatchResultNotificationMode] = useState<"TEXT" | "IMAGE" | "BOTH">("TEXT");
  const [pollResultNotificationMode, setPollResultNotificationMode] = useState<"TEXT" | "IMAGE" | "BOTH">("TEXT");
  const [evolutionStatus, setEvolutionStatus] = useState<EvolutionStatus | null>(null);
  const [evolutionGroups, setEvolutionGroups] = useState<EvolutionGroup[]>([]);
  const [descriptionBlocks, setDescriptionBlocks] = useState<DescriptionBlock[]>([]);
  const [descriptionPreview, setDescriptionPreview] = useState("");
  const [descriptionLength, setDescriptionLength] = useState(0);
  const [newBlockContent, setNewBlockContent] = useState("");
  const [newBlockPosition, setNewBlockPosition] = useState<"ABOVE" | "BELOW">("BELOW");
  const [newBlockSortOrder, setNewBlockSortOrder] = useState("0");
  const [commandHelpMessage, setCommandHelpMessage] = useState("");
  const [botCommands, setBotCommands] = useState<CommandInfo[]>([]);
  const [instanceNameInput, setInstanceNameInput] = useState("");
  const [instanceNumberInput, setInstanceNumberInput] = useState("");
  const [qrCodeData, setQrCodeData] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [loadingWhatsAppOps, setLoadingWhatsAppOps] = useState(false);
  const [gameConfig, setGameConfig] = useState<GameConfig>({ maps: [], characters: [], characterLabel: "Operator", playerRoles: [] });
  const [newMap, setNewMap] = useState("");
  const [newCharacter, setNewCharacter] = useState("");
  const [newRole, setNewRole] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const initialTeamForm = useRef({ name: "", tag: "", description: "", discordWebhookUrl: "" });
  const initialAnnouncementMode = useRef<"TEXT" | "IMAGE" | "BOTH">("TEXT");
  const initialMatchResultMode = useRef<"TEXT" | "IMAGE" | "BOTH">("TEXT");
  const initialPollResultMode = useRef<"TEXT" | "IMAGE" | "BOTH">("TEXT");
  const initialEmailEnabled = useRef(true);
  const initialWhatsappEnabled = useRef(false);
  const initialWhatsappGroupJid = useRef("");

  // Nur Admins dürfen hier rein
  useEffect(() => {
    if (!loading && user && !user.isAdmin) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  const load = useCallback(async () => {
    try {
      const [teamRes, membersRes, notifyRes, configRes] = await Promise.allSettled([
        api.get<TeamSettings>("/api/team"),
        api.get<MemberData[]>("/api/team/members"),
        api.get<NotificationConfig>("/api/team/notification-config"),
        api.get<GameConfig>("/api/team/config"),
      ]);
      if (teamRes.status === "fulfilled" && teamRes.value.data) {
        const ts = teamRes.value.data;
        setTeamSettings(ts);
        const form = { name: ts.name, tag: ts.tag, description: ts.description || "", discordWebhookUrl: ts.discordWebhookUrl || "" };
        setTeamForm(form);
        initialTeamForm.current = form;
        setEmailNotificationsEnabled(ts.emailNotificationsEnabled ?? true);
        setWhatsappNotificationsEnabled(ts.whatsappNotificationsEnabled ?? false);
        setWhatsappGroupJid(ts.whatsappGroupJid || "");
        initialEmailEnabled.current = ts.emailNotificationsEnabled ?? true;
        initialWhatsappEnabled.current = ts.whatsappNotificationsEnabled ?? false;
        initialWhatsappGroupJid.current = ts.whatsappGroupJid || "";
        const announcementMode = ts.announcementNotificationMode || "TEXT";
        const matchMode = ts.matchResultNotificationMode || "TEXT";
        const pollMode = ts.pollResultNotificationMode || "TEXT";
        setAnnouncementNotificationMode(announcementMode);
        setMatchResultNotificationMode(matchMode);
        setPollResultNotificationMode(pollMode);
        initialAnnouncementMode.current = announcementMode;
        initialMatchResultMode.current = matchMode;
        initialPollResultMode.current = pollMode;
      }
      if (membersRes.status === "fulfilled" && membersRes.value.data) {
        setMembers(membersRes.value.data);
      }
      if (notifyRes.status === "fulfilled" && notifyRes.value.data) {
        setNotifyConfig(notifyRes.value.data);
      }
      if (configRes.status === "fulfilled" && configRes.value.data) {
        setGameConfig(configRes.value.data);
      }
    } catch {
      error(tc("loadError"));
    } finally {
      setLoading(false);
    }
  }, [user, error]);

  useEffect(() => { load(); }, [load]);

  const loadWhatsAppAdmin = useCallback(async () => {
    setLoadingWhatsAppOps(true);
    try {
      const [statusRes, groupsRes, blocksRes, previewRes, commandsRes] = await Promise.all([
        api.get<EvolutionStatus>("/api/team/whatsapp/status"),
        api.get<EvolutionGroup[]>("/api/team/whatsapp/groups"),
        api.get<DescriptionBlock[]>("/api/team/whatsapp/description/blocks"),
        api.get<{ description: string; length: number; maxLength: number }>("/api/team/whatsapp/description/preview"),
        api.get<{ commands: CommandInfo[]; helpMessage: string }>("/api/team/whatsapp/commands"),
      ]);
      setEvolutionStatus(statusRes.data || null);
      setEvolutionGroups(groupsRes.data || []);
      setDescriptionBlocks(blocksRes.data || []);
      setDescriptionPreview(previewRes.data?.description || "");
      setDescriptionLength(previewRes.data?.length || 0);
      setBotCommands(commandsRes.data?.commands || []);
      setCommandHelpMessage(commandsRes.data?.helpMessage || "");
      if (statusRes.data?.instance) setInstanceNameInput(statusRes.data.instance);
    } catch {
      error("WhatsApp-Admin-Daten konnten nicht geladen werden.");
    } finally {
      setLoadingWhatsAppOps(false);
    }
  }, [error]);

  useEffect(() => {
    if (tab === "notifications") {
      void loadWhatsAppAdmin();
    }
  }, [tab, loadWhatsAppAdmin]);

  const hasUnsavedChanges = () => {
    const tf = initialTeamForm.current;
    const teamDirty = teamForm.name !== tf.name || teamForm.tag !== tf.tag || teamForm.description !== tf.description || teamForm.discordWebhookUrl !== tf.discordWebhookUrl;
    const channelDirty = emailNotificationsEnabled !== initialEmailEnabled.current
      || whatsappNotificationsEnabled !== initialWhatsappEnabled.current
      || whatsappGroupJid !== initialWhatsappGroupJid.current
      || announcementNotificationMode !== initialAnnouncementMode.current
      || matchResultNotificationMode !== initialMatchResultMode.current
      || pollResultNotificationMode !== initialPollResultMode.current;
    return teamDirty || channelDirty;
  };

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  });

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

  const saveNotificationSettings = async () => {
    setSaving(true);
    try {
      await api.put("/api/team", {
        emailNotificationsEnabled,
        whatsappNotificationsEnabled,
        whatsappGroupJid: whatsappGroupJid || null,
        announcementNotificationMode,
        matchResultNotificationMode,
        pollResultNotificationMode,
      });
      success(tc("saved"));
      await Promise.all([load(), loadWhatsAppAdmin()]);
    } catch {
      error(tc("saveError"));
    } finally {
      setSaving(false);
    }
  };

  const createInstance = async () => {
    if (!instanceNameInput.trim()) {
      error("Bitte einen Instanznamen angeben.");
      return;
    }
    try {
      await api.post("/api/team/whatsapp/instances", {
        instanceName: instanceNameInput.trim(),
        number: instanceNumberInput.trim() || null,
        groupsIgnore: false,
      });
      success("Instanz erstellt.");
      await loadWhatsAppAdmin();
    } catch {
      error("Instanz konnte nicht erstellt werden.");
    }
  };

  const fetchQr = async () => {
    if (!instanceNameInput.trim()) {
      error("Bitte einen Instanznamen angeben.");
      return;
    }
    try {
      const res = await api.post<{ pairingCode?: string; code?: string }>("/api/team/whatsapp/connect", {
        instanceName: instanceNameInput.trim(),
        number: instanceNumberInput.trim() || null,
      });
      setPairingCode(res.data?.pairingCode || "");
      setQrCodeData(res.data?.code ? await QRCode.toDataURL(res.data.code) : "");
      success("QR/Pairing-Code geladen.");
    } catch {
      error("QR-Code konnte nicht geladen werden.");
    }
  };

  const setupWebhook = async () => {
    if (!instanceNameInput.trim()) {
      error("Bitte einen Instanznamen angeben.");
      return;
    }
    try {
      await api.post("/api/team/whatsapp/webhook", { instanceName: instanceNameInput.trim() });
      success("Webhook gesetzt.");
      await loadWhatsAppAdmin();
    } catch {
      error("Webhook konnte nicht gesetzt werden.");
    }
  };

  const postCommands = async () => {
    try {
      await api.post("/api/team/whatsapp/commands/post", { message: commandHelpMessage });
      success("Befehlsliste wurde in die Gruppe gesendet.");
    } catch {
      error("Befehlsliste konnte nicht gesendet werden.");
    }
  };

  const addDescriptionBlock = async () => {
    if (!newBlockContent.trim()) {
      error("Bitte Text fuer den Block eingeben.");
      return;
    }
    try {
      await api.post("/api/team/whatsapp/description/blocks", {
        content: newBlockContent.trim(),
        position: newBlockPosition,
        sortOrder: Number.parseInt(newBlockSortOrder || "0", 10) || 0,
      });
      setNewBlockContent("");
      setNewBlockSortOrder("0");
      success("Block gespeichert.");
      await loadWhatsAppAdmin();
    } catch {
      error("Block konnte nicht gespeichert werden.");
    }
  };

  const deleteDescriptionBlock = async (id: string) => {
    try {
      await api.delete(`/api/team/whatsapp/description/blocks/${id}`);
      success("Block geloescht.");
      await loadWhatsAppAdmin();
    } catch {
      error("Block konnte nicht geloescht werden.");
    }
  };

  const updateGroupDescriptionNow = async () => {
    try {
      await api.post("/api/team/whatsapp/description/update");
      success("Gruppenbeschreibung aktualisiert.");
      await loadWhatsAppAdmin();
    } catch {
      error("Gruppenbeschreibung konnte nicht aktualisiert werden.");
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
          { id: "team" as const, label: t("tabs.team"), icon: Settings },
          { id: "game" as const, label: "Game Config", icon: Gamepad2 },
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

      {/* Data Export */}
      {tab === "team" && (
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <Download className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Daten-Export</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Match-Statistiken", endpoint: "/api/export/matches" },
              { label: "Training-Teilnahme", endpoint: "/api/export/training-attendance" },
              { label: "Verfügbarkeit", endpoint: "/api/export/availability" },
            ].map((exp) => (
              <div key={exp.endpoint} className="flex flex-col gap-2 rounded-lg bg-[var(--secondary)] p-3">
                <span className="text-sm font-medium text-[var(--foreground)]">{exp.label}</span>
                <div className="flex gap-2">
                  <a href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}${exp.endpoint}?format=csv`} className="flex-1 rounded-lg border border-[var(--border)] px-2 py-1.5 text-center text-xs font-medium text-[var(--foreground)] hover:bg-[var(--primary)]/10 transition-colors" download>CSV</a>
                  <a href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}${exp.endpoint}?format=json`} className="flex-1 rounded-lg border border-[var(--border)] px-2 py-1.5 text-center text-xs font-medium text-[var(--foreground)] hover:bg-[var(--primary)]/10 transition-colors" download>JSON</a>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Game Config */}
      {tab === "game" && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">Game Config</h2>
          <div className="space-y-6">
            {/* Maps */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Maps</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {gameConfig.maps.map((m) => (
                  <span key={m} className="inline-flex items-center gap-1 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-sm text-[var(--foreground)]">
                    {m}
                    <button onClick={() => setGameConfig({ ...gameConfig, maps: gameConfig.maps.filter(x => x !== m) })} className="text-[var(--muted-foreground)] hover:text-[var(--destructive)]"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newMap} onChange={(e) => setNewMap(e.target.value)} placeholder="Neue Map..." onKeyDown={(e) => { if (e.key === "Enter" && newMap.trim()) { setGameConfig({ ...gameConfig, maps: [...gameConfig.maps, newMap.trim()] }); setNewMap(""); } }} className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none" />
                <Button size="sm" variant="outline" onClick={() => { if (newMap.trim()) { setGameConfig({ ...gameConfig, maps: [...gameConfig.maps, newMap.trim()] }); setNewMap(""); } }}><Plus className="h-3.5 w-3.5" /></Button>
              </div>
            </div>

            {/* Characters */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">{gameConfig.characterLabel || "Characters"}</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {gameConfig.characters.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-sm text-[var(--foreground)]">
                    {c}
                    <button onClick={() => setGameConfig({ ...gameConfig, characters: gameConfig.characters.filter(x => x !== c) })} className="text-[var(--muted-foreground)] hover:text-[var(--destructive)]"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newCharacter} onChange={(e) => setNewCharacter(e.target.value)} placeholder={`${gameConfig.characterLabel || "Character"} hinzufügen...`} onKeyDown={(e) => { if (e.key === "Enter" && newCharacter.trim()) { setGameConfig({ ...gameConfig, characters: [...gameConfig.characters, newCharacter.trim()] }); setNewCharacter(""); } }} className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none" />
                <Button size="sm" variant="outline" onClick={() => { if (newCharacter.trim()) { setGameConfig({ ...gameConfig, characters: [...gameConfig.characters, newCharacter.trim()] }); setNewCharacter(""); } }}><Plus className="h-3.5 w-3.5" /></Button>
              </div>
            </div>

            {/* Character Label */}
            <Input label="Character Label" value={gameConfig.characterLabel} onChange={(e) => setGameConfig({ ...gameConfig, characterLabel: e.target.value })} placeholder="z.B. Operator, Agent, Hero..." />

            {/* Player Roles */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Spieler-Rollen</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {gameConfig.playerRoles.map((r) => (
                  <span key={r} className="inline-flex items-center gap-1 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-sm text-[var(--foreground)]">
                    {r}
                    <button onClick={() => setGameConfig({ ...gameConfig, playerRoles: gameConfig.playerRoles.filter(x => x !== r) })} className="text-[var(--muted-foreground)] hover:text-[var(--destructive)]"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="Rolle hinzufügen..." onKeyDown={(e) => { if (e.key === "Enter" && newRole.trim()) { setGameConfig({ ...gameConfig, playerRoles: [...gameConfig.playerRoles, newRole.trim()] }); setNewRole(""); } }} className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none" />
                <Button size="sm" variant="outline" onClick={() => { if (newRole.trim()) { setGameConfig({ ...gameConfig, playerRoles: [...gameConfig.playerRoles, newRole.trim()] }); setNewRole(""); } }}><Plus className="h-3.5 w-3.5" /></Button>
              </div>
            </div>

            <Button onClick={async () => {
              setSavingConfig(true);
              try {
                await api.put("/api/team/config", gameConfig);
                success(tc("saved"));
              } catch { error(tc("saveError")); }
              finally { setSavingConfig(false); }
            }} isLoading={savingConfig}>
              <Save className="h-4 w-4" /> {tc("save")}
            </Button>
          </div>
        </Card>
      )}

      {/* Notification Channel */}
      {tab === "notifications" && (
        <>
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">{t("notifications.title")}</h2>
          <p className="mb-4 text-sm text-[var(--muted-foreground)]">
            {t("notifications.description")}
          </p>
          <div className="space-y-3">
            {([
              { value: "EMAIL", label: t("notifications.email"), desc: t("notifications.emailDesc"), available: notifyConfig.email, enabled: emailNotificationsEnabled, setEnabled: setEmailNotificationsEnabled },
              { value: "WHATSAPP", label: t("notifications.whatsapp"), desc: t("notifications.whatsappDesc"), available: notifyConfig.whatsapp, enabled: whatsappNotificationsEnabled, setEnabled: setWhatsappNotificationsEnabled },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                disabled={!opt.available}
                onClick={() => opt.available && opt.setEnabled(!opt.enabled)}
                className={`w-full rounded-lg border p-4 text-left transition-all ${
                  opt.enabled
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
                  {!opt.available ? (
                    <Badge variant="outline">{tc("notConfigured")}</Badge>
                  ) : (
                    <div className={`h-3 w-3 rounded-full ${opt.enabled ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`} />
                  )}
                </div>
              </button>
            ))}
          </div>
          <Input
            label="WhatsApp Gruppen-JID"
            value={whatsappGroupJid}
            onChange={(e) => setWhatsappGroupJid(e.target.value)}
            placeholder="1234567890-123456789@g.us"
          />
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Select
              label="Ankündigungen per WhatsApp"
              value={announcementNotificationMode}
              onChange={(e) => setAnnouncementNotificationMode(e.target.value as "TEXT" | "IMAGE" | "BOTH")}
              options={[
                { value: "TEXT", label: "Nur Text" },
                { value: "IMAGE", label: "Nur Bild" },
                { value: "BOTH", label: "Bild + Text" },
              ]}
            />
            <Select
              label="Match-Ergebnisse per WhatsApp"
              value={matchResultNotificationMode}
              onChange={(e) => setMatchResultNotificationMode(e.target.value as "TEXT" | "IMAGE" | "BOTH")}
              options={[
                { value: "TEXT", label: "Nur Text" },
                { value: "IMAGE", label: "Nur Bild" },
                { value: "BOTH", label: "Bild + Text" },
              ]}
            />
            <Select
              label="Poll-Ergebnisse per WhatsApp"
              value={pollResultNotificationMode}
              onChange={(e) => setPollResultNotificationMode(e.target.value as "TEXT" | "IMAGE" | "BOTH")}
              options={[
                { value: "TEXT", label: "Nur Text" },
                { value: "IMAGE", label: "Nur Bild" },
                { value: "BOTH", label: "Bild + Text" },
              ]}
            />
          </div>
          <div className="mt-4">
            <Button onClick={saveNotificationSettings} isLoading={saving}>
              <Save className="h-4 w-4" /> {tc("save")}
            </Button>
          </div>
        </Card>
        <Card>
          <div className="mb-4 flex items-center gap-3">
            <QrCode className="h-5 w-5 text-[var(--primary)]" />
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Evolution API</h2>
              <p className="text-sm text-[var(--muted-foreground)]">Instanz, QR-Code, Webhook und Gruppen abrufen</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Instanzname" value={instanceNameInput} onChange={(e) => setInstanceNameInput(e.target.value)} />
            <Input label="Optional Telefonnummer" value={instanceNumberInput} onChange={(e) => setInstanceNumberInput(e.target.value)} placeholder="491234567890" />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={createInstance}>
              <Plus className="h-4 w-4" /> Instanz erstellen
            </Button>
            <Button variant="outline" onClick={fetchQr}>
              <QrCode className="h-4 w-4" /> QR laden
            </Button>
            <Button variant="outline" onClick={setupWebhook}>
              <RefreshCw className="h-4 w-4" /> Webhook setzen
            </Button>
            <Button variant="outline" onClick={loadWhatsAppAdmin} isLoading={loadingWhatsAppOps}>
              <RefreshCw className="h-4 w-4" /> Gruppen aktualisieren
            </Button>
          </div>

          {evolutionStatus && (
            <div className="mt-4 rounded-lg bg-[var(--secondary)] p-4 text-sm text-[var(--muted-foreground)]">
              <p><strong className="text-[var(--foreground)]">API:</strong> {evolutionStatus.apiUrl || "Nicht gesetzt"}</p>
              <p><strong className="text-[var(--foreground)]">Hauptinstanz:</strong> {evolutionStatus.instance || "Nicht gesetzt"}</p>
              <p><strong className="text-[var(--foreground)]">Private Instanz:</strong> {evolutionStatus.attendanceInstance || "Nicht gesetzt"}</p>
              <p><strong className="text-[var(--foreground)]">Gruppen-JID:</strong> {evolutionStatus.groupJid || "Nicht gesetzt"}</p>
            </div>
          )}

          {pairingCode && (
            <div className="mt-4 rounded-lg bg-[var(--secondary)] p-4">
              <p className="text-sm font-medium text-[var(--foreground)]">Pairing-Code</p>
              <p className="mt-1 font-mono text-sm text-[var(--primary)]">{pairingCode}</p>
            </div>
          )}

          {qrCodeData && (
            <div className="mt-4 rounded-lg bg-white p-4">
              <img src={`data:image/png;base64,${qrCodeData}`} alt="Evolution QR" className="mx-auto max-h-72 w-auto" />
            </div>
          )}

          <div className="mt-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Gefundene Gruppen</h3>
            <div className="space-y-2">
              {evolutionGroups.map((group) => (
                <div key={group.id} className="rounded-lg border border-[var(--border)] p-3">
                  <p className="font-medium text-[var(--foreground)]">{group.subject || "Ohne Namen"}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{group.id}</p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">Mitglieder: {group.size ?? "-"}</p>
                </div>
              ))}
              {evolutionGroups.length === 0 && (
                <p className="text-sm text-[var(--muted-foreground)]">Noch keine Gruppen geladen.</p>
              )}
            </div>
          </div>
        </Card>
        <Card>
          <div className="mb-4 flex items-center gap-3">
            <Bot className="h-5 w-5 text-[var(--primary)]" />
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Bot-Befehle</h2>
              <p className="text-sm text-[var(--muted-foreground)]">Diese Befehle funktionieren in der WhatsApp-Gruppe.</p>
            </div>
          </div>
          <div className="space-y-2">
            {botCommands.map((entry) => (
              <div key={entry.command} className="rounded-lg bg-[var(--secondary)] p-3">
                <p className="font-mono text-sm text-[var(--foreground)]">{entry.command}</p>
                <p className="text-sm text-[var(--muted-foreground)]">{entry.description}</p>
              </div>
            ))}
          </div>
          <Textarea label="Nachricht fuer den angepinnten Befehlspost" value={commandHelpMessage} onChange={(e) => setCommandHelpMessage(e.target.value)} />
          <div className="mt-4">
            <Button variant="outline" onClick={postCommands}>
              <Send className="h-4 w-4" /> Befehlsliste in Gruppe senden
            </Button>
          </div>
        </Card>
        <Card>
          <div className="mb-4 flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-[var(--primary)]" />
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Gruppenbeschreibung</h2>
              <p className="text-sm text-[var(--muted-foreground)]">Naechster Termin, offene Umfragen, Folgetermine und deine Zusatzbloecke.</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_140px_120px]">
            <Textarea label="Neuer Zusatzblock" value={newBlockContent} onChange={(e) => setNewBlockContent(e.target.value)} />
            <Select
              label="Position"
              value={newBlockPosition}
              onChange={(e) => setNewBlockPosition(e.target.value as "ABOVE" | "BELOW")}
              options={[
                { value: "ABOVE", label: "Oberhalb" },
                { value: "BELOW", label: "Unterhalb" },
              ]}
            />
            <Input label="Sortierung" value={newBlockSortOrder} onChange={(e) => setNewBlockSortOrder(e.target.value)} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={addDescriptionBlock}>
              <Plus className="h-4 w-4" /> Block speichern
            </Button>
            <Button variant="outline" onClick={updateGroupDescriptionNow}>
              <RefreshCw className="h-4 w-4" /> Jetzt in WhatsApp aktualisieren
            </Button>
          </div>

          <div className="mt-6 space-y-2">
            {descriptionBlocks.map((block) => (
              <div key={block.id} className="flex items-start justify-between gap-3 rounded-lg bg-[var(--secondary)] p-3">
                <div>
                  <p className="text-xs uppercase text-[var(--muted-foreground)]">{block.position} | Sort {block.sortOrder}</p>
                  <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">{block.content}</p>
                </div>
                <button onClick={() => deleteDescriptionBlock(block.id)} className="rounded p-1.5 text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {descriptionBlocks.length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)]">Noch keine Zusatzbloecke vorhanden.</p>
            )}
          </div>

          <div className="mt-6 rounded-lg border border-[var(--border)] p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Vorschau</h3>
              <span className="text-xs text-[var(--muted-foreground)]">{descriptionLength} / 2048</span>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-[var(--muted-foreground)]">{descriptionPreview || "Noch keine Vorschau geladen."}</pre>
          </div>
        </Card>
        <BrowserNotificationSettings />
        </>
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
                      {m.user.isAdmin && m.role !== "ADMIN" && <Badge variant="default">Admin</Badge>}
                    </div>
                    <span className="text-xs text-[var(--muted-foreground)]">@{m.user.username}</span>
                  </div>
                  <select
                    value={m.role}
                    onChange={async (e) => {
                      try {
                        await api.put(`/api/team/members/${m.user.id}`, { role: e.target.value, status: m.status, phone: m.user.phone, emailNotifications: m.user.emailNotifications });
                        success(tc("saved"));
                        load();
                      } catch { error(tc("saveError")); }
                    }}
                    className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
                  >
                    {["TRYOUT", "PLAYER", "ANALYST", "COACH", "CAPTAIN"].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <select
                    value={m.status}
                    onChange={async (e) => {
                      try {
                        await api.put(`/api/team/members/${m.user.id}`, { role: m.role, status: e.target.value, phone: m.user.phone, emailNotifications: m.user.emailNotifications });
                        success(tc("saved"));
                        load();
                      } catch { error(tc("saveError")); }
                    }}
                    className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
                  >
                    {["ACTIVE", "SUBSTITUTE", "BENCH", "INACTIVE"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <input
                    value={m.user.phone || ""}
                    onChange={(e) => setMembers((prev) => prev.map((member) => member.id === m.id ? { ...member, user: { ...member.user, phone: e.target.value } } : member))}
                    onBlur={async () => {
                      try {
                        await api.put(`/api/team/members/${m.user.id}`, { role: m.role, status: m.status, phone: m.user.phone || null, emailNotifications: m.user.emailNotifications });
                        success(tc("saved"));
                        load();
                      } catch { error(tc("saveError")); }
                    }}
                    placeholder="+491234567890"
                    className="w-36 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
                  />
                  <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    <input
                      type="checkbox"
                      checked={Boolean(m.user.emailNotifications)}
                      onChange={async (e) => {
                        try {
                          await api.put(`/api/team/members/${m.user.id}`, { role: m.role, status: m.status, phone: m.user.phone || null, emailNotifications: e.target.checked });
                          success(tc("saved"));
                          load();
                        } catch { error(tc("saveError")); }
                      }}
                    />
                    E-Mail
                  </label>
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
