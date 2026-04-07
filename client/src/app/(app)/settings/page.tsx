"use client";
import { useEffect, useState, useCallback } from "react";
import { Settings, Shield, User, Save, Upload, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Textarea } from "@/components/ui/Input";

interface TeamSettings {
  id: string;
  name: string;
  tag: string;
  description?: string;
  logoUrl?: string;
  discordWebhook?: string;
  defaultTimezone?: string;
}

interface Member {
  id: string;
  displayName: string;
  avatarUrl?: string;
  role: string;
  isAdmin: boolean;
  joinedAt: string;
}

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<"personal" | "team" | "members">("personal");
  const [teamSettings, setTeamSettings] = useState<TeamSettings | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: "", tag: "", description: "", discordWebhook: "" });
  const [personalForm, setPersonalForm] = useState({ displayName: "", email: "" });
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const [teamRes, membersRes] = await Promise.allSettled([
        api.get<TeamSettings>("/api/teams/settings"),
        api.get<Member[]>("/api/members"),
      ]);
      if (teamRes.status === "fulfilled" && teamRes.value.data) {
        const ts = teamRes.value.data;
        setTeamSettings(ts);
        setTeamForm({ name: ts.name, tag: ts.tag, description: ts.description || "", discordWebhook: ts.discordWebhook || "" });
      }
      if (membersRes.status === "fulfilled" && membersRes.value.data) {
        setMembers(membersRes.value.data);
      }
      if (user) {
        setPersonalForm({ displayName: user.displayName, email: user.email || "" });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const saveTeam = async () => {
    setSaving(true);
    setMessage("");
    try {
      await api.put("/api/teams/settings", teamForm);
      setMessage("Team-Einstellungen gespeichert!");
      load();
    } catch {
      setMessage("Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  };

  const savePersonal = async () => {
    setSaving(true);
    setMessage("");
    try {
      await api.put("/api/users/me", personalForm);
      setMessage("Persoenliche Einstellungen gespeichert!");
    } catch {
      setMessage("Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  };

  const toggleAdmin = async (memberId: string) => {
    try {
      await api.patch(`/api/members/${memberId}/admin`);
      load();
    } catch {
      // ignore
    }
  };

  const removeMember = async (memberId: string) => {
    if (!confirm("Mitglied wirklich entfernen?")) return;
    try {
      await api.delete(`/api/members/${memberId}`);
      load();
    } catch {
      // ignore
    }
  };

  const uploadLogo = async (file: File) => {
    try {
      await api.upload("/api/teams/logo", file);
      load();
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Einstellungen</h1>
        <p className="text-[var(--muted-foreground)]">Team- und persoenliche Einstellungen</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-[var(--secondary)] p-1">
        {[
          { id: "personal" as const, label: "Persoenlich", icon: User },
          ...(user?.isAdmin
            ? [
                { id: "team" as const, label: "Team", icon: Settings },
                { id: "members" as const, label: "Mitglieder", icon: Shield },
              ]
            : []),
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${tab === t.id ? "bg-[var(--primary)] text-white" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {message && (
        <div className={`rounded-lg p-3 text-sm ${message.includes("Fehler") ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"}`}>
          {message}
        </div>
      )}

      {/* Personal Settings */}
      {tab === "personal" && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">Persoenliche Einstellungen</h2>
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
            <Input label="Anzeigename" value={personalForm.displayName} onChange={(e) => setPersonalForm({ ...personalForm, displayName: e.target.value })} />
            <Input label="E-Mail" type="email" value={personalForm.email} onChange={(e) => setPersonalForm({ ...personalForm, email: e.target.value })} />
            <Button onClick={savePersonal} isLoading={saving}>
              <Save className="h-4 w-4" /> Speichern
            </Button>
          </div>
        </Card>
      )}

      {/* Team Settings (Admin only) */}
      {tab === "team" && user?.isAdmin && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">Team-Einstellungen</h2>
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
                <label className="block text-sm font-medium text-[var(--foreground)]">Team-Logo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
                  className="mt-1 text-sm text-[var(--muted-foreground)] file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--primary)] file:px-3 file:py-1.5 file:text-sm file:text-white"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Teamname" value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} />
              <Input label="Team-Tag" value={teamForm.tag} onChange={(e) => setTeamForm({ ...teamForm, tag: e.target.value })} placeholder="z.B. NP" />
            </div>
            <Textarea label="Beschreibung" value={teamForm.description} onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })} />
            <Input label="Discord Webhook URL" value={teamForm.discordWebhook} onChange={(e) => setTeamForm({ ...teamForm, discordWebhook: e.target.value })} placeholder="https://discord.com/api/webhooks/..." />
            <Button onClick={saveTeam} isLoading={saving}>
              <Save className="h-4 w-4" /> Speichern
            </Button>
          </div>
        </Card>
      )}

      {/* Members Management (Admin only) */}
      {tab === "members" && user?.isAdmin && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">Mitglieder ({members.length})</h2>
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg bg-[var(--secondary)] p-3">
                {m.avatarUrl ? (
                  <img src={m.avatarUrl} alt="" className="h-10 w-10 rounded-full" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)]/20 text-sm font-bold text-[var(--primary)]">
                    {m.displayName.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[var(--foreground)]">{m.displayName}</span>
                    {m.isAdmin && <Badge variant="default">Admin</Badge>}
                    <Badge variant="outline">{m.role}</Badge>
                  </div>
                </div>
                {m.id !== user.id && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => toggleAdmin(m.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${m.isAdmin ? "bg-[var(--primary)]/20 text-[var(--primary)]" : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--primary)]"}`}
                    >
                      <Shield className="inline h-3.5 w-3.5" /> {m.isAdmin ? "Admin" : "Admin machen"}
                    </button>
                    <button onClick={() => removeMember(m.id)} className="rounded p-1.5 text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
