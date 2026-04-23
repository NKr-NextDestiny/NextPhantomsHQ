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
