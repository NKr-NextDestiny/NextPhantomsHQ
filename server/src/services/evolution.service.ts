import { config } from "../config/index.js";
import { logger } from "../config/logger.js";

export interface EvolutionMediaPayload {
  data: Buffer;
  fileName: string;
  mimetype: string;
}

export type NotificationContentMode = "TEXT" | "IMAGE" | "BOTH";

function evolutionUrl(path: string): string {
  return `${config.evolutionApiUrl}${path}`;
}

function instanceName(kind: "group" | "private" = "group"): string {
  if (kind === "private") {
    return config.evolutionAttendanceInstance || config.evolutionInstance;
  }
  return config.evolutionInstance;
}

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: config.evolutionApiKey,
  };
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function normalizeRecipient(phone: string): string {
  if (phone.includes("@g.us") || phone.includes("@s.whatsapp.net")) return phone;
  return phone.replace(/^\+/, "").replace(/\D/g, "");
}

function toBase64(data: Buffer): string {
  return data.toString("base64");
}

export function isEvolutionConfigured(): boolean {
  return Boolean(config.evolutionApiUrl && config.evolutionApiKey && config.evolutionInstance);
}

export interface EvolutionInstanceSummary {
  instance?: {
    instanceName?: string;
    instanceId?: string;
    owner?: string;
    profileName?: string;
    profilePictureUrl?: string | null;
    status?: string;
    serverUrl?: string;
  };
  hash?: {
    apikey?: string;
  };
}

export interface EvolutionGroupSummary {
  id: string;
  subject?: string;
  desc?: string | null;
  size?: number;
  owner?: string;
  announce?: boolean;
  restrict?: boolean;
}

async function request<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(evolutionUrl(path), {
    ...init,
    headers: {
      ...headers(),
      ...(init?.headers ?? {}),
    },
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(`[Evolution] ${path} failed: ${response.status} ${JSON.stringify(payload)}`);
  }

  return payload as T;
}

export async function sendWhatsAppText(phone: string, text: string, kind: "group" | "private" = "group"): Promise<void> {
  if (!isEvolutionConfigured()) return;

  try {
    const response = await fetch(evolutionUrl(`/message/sendText/${instanceName(kind)}`), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        number: normalizeRecipient(phone),
        text,
        linkPreview: true,
      }),
    });
    if (!response.ok) {
      logger.error(`[Evolution] Text send failed for ${phone}: ${response.status} ${await response.text()}`);
    }
  } catch (err) {
    logger.error(err, `[Evolution] Failed to send text message to ${phone}`);
  }
}

export async function sendWhatsAppMedia(
  phone: string,
  media: EvolutionMediaPayload,
  caption?: string,
  kind: "group" | "private" = "group",
): Promise<void> {
  if (!isEvolutionConfigured()) return;

  try {
    const response = await fetch(evolutionUrl(`/message/sendMedia/${instanceName(kind)}`), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        number: normalizeRecipient(phone),
        mediatype: "image",
        mimetype: media.mimetype,
        caption: caption ?? "",
        media: toBase64(media.data),
        fileName: media.fileName,
      }),
    });
    if (!response.ok) {
      logger.error(`[Evolution] Media send failed for ${phone}: ${response.status} ${await response.text()}`);
    }
  } catch (err) {
    logger.error(err, `[Evolution] Failed to send media message to ${phone}`);
  }
}

export async function sendWhatsAppNotification(
  phone: string,
  text: string,
  mode: NotificationContentMode,
  media?: EvolutionMediaPayload | null,
): Promise<void> {
  if (mode === "TEXT" || !media) {
    await sendWhatsAppText(phone, text);
    return;
  }

  await sendWhatsAppMedia(phone, media, mode === "BOTH" ? text : "", "group");
}

export async function fetchInstances(): Promise<EvolutionInstanceSummary[]> {
  if (!isEvolutionConfigured()) return [];
  try {
    return await request<EvolutionInstanceSummary[]>("/instance/fetchInstances", { method: "GET" });
  } catch (error) {
    logger.error(error, "[Evolution] Failed to fetch instances");
    return [];
  }
}

export async function createInstance(
  instanceName: string,
  options?: {
    qrcode?: boolean;
    number?: string;
    groupsIgnore?: boolean;
    webhookUrl?: string;
    events?: string[];
  },
) {
  return request("/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName,
      integration: "WHATSAPP-BAILEYS",
      qrcode: options?.qrcode ?? true,
      number: options?.number,
      rejectCall: true,
      groupsIgnore: options?.groupsIgnore ?? false,
      alwaysOnline: false,
      readMessages: false,
      readStatus: false,
      syncFullHistory: false,
      webhook: options?.webhookUrl ? {
        url: options.webhookUrl,
        byEvents: true,
        base64: true,
        events: options?.events ?? ["MESSAGES_UPSERT", "QRCODE_UPDATED", "CONNECTION_UPDATE", "GROUPS_UPSERT", "GROUPS_UPDATE"],
      } : undefined,
    }),
  });
}

export async function connectInstance(instanceName: string, number?: string) {
  const query = number ? `?number=${encodeURIComponent(number)}` : "";
  return request<{ pairingCode?: string; code?: string; count?: number }>(`/instance/connect/${instanceName}${query}`, {
    method: "GET",
  });
}

export async function fetchAllGroups(instanceName = config.evolutionInstance): Promise<EvolutionGroupSummary[]> {
  if (!isEvolutionConfigured()) return [];
  try {
    return await request<EvolutionGroupSummary[]>(`/group/fetchAllGroups/${instanceName}`, { method: "GET" });
  } catch (error) {
    logger.error(error, "[Evolution] Failed to fetch groups");
    return [];
  }
}

export async function updateGroupDescription(instanceName: string, groupJid: string, description: string) {
  return request(`/group/updateGroupDescription/${instanceName}?groupJid=${encodeURIComponent(groupJid)}`, {
    method: "POST",
    body: JSON.stringify({ description }),
  });
}

export async function findWebhook(instanceName: string) {
  return request<{ enabled?: boolean; url?: string; events?: string[] }>(`/webhook/find/${instanceName}`, {
    method: "GET",
  });
}

export async function setWebhook(instanceName: string, url: string, events: string[]) {
  return request(`/webhook/set/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({
      url,
      events,
      webhook_by_events: true,
      webhook_base64: true,
    }),
  });
}
