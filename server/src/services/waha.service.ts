import { config } from "../config/index.js";
import { logger } from "../config/logger.js";

function wahaUrl(path: string): string {
  return `${config.wahaApiUrl}${path}`;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (config.wahaApiKey) h["X-Api-Key"] = config.wahaApiKey;
  return h;
}

export function isWahaConfigured(): boolean {
  return Boolean(config.wahaApiUrl);
}

/** Send a text message to a WhatsApp number (international format like +491234567890). */
export async function sendWhatsAppMessage(phone: string, text: string): Promise<void> {
  if (!isWahaConfigured()) return;

  const chatId = phone.replace(/^\+/, "").replace(/\D/g, "") + "@c.us";
  try {
    await fetch(wahaUrl("/api/sendText"), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ session: config.wahaSession, chatId, text }),
    });
  } catch (err) {
    logger.error(err, `[WAHA] Failed to send message to ${phone}`);
  }
}

export async function sendNewEventNotification(phone: string, eventType: string, title: string, date: string, createdBy: string): Promise<void> {
  await sendWhatsAppMessage(phone,
    `📢 *Neues ${eventType}: ${title}*\n📅 ${date}\n👤 Erstellt von ${createdBy}\n\nLogge dich ein um abzustimmen.\n\n_🤖 Next Phantoms HQ_`);
}

export async function sendEventUpdatedNotification(phone: string, eventType: string, title: string, date: string, updatedBy: string): Promise<void> {
  await sendWhatsAppMessage(phone,
    `✏️ *${eventType} aktualisiert: ${title}*\n📅 ${date}\n👤 Geändert von ${updatedBy}\n\n_🤖 Next Phantoms HQ_`);
}

export async function sendEventDeletedNotification(phone: string, eventType: string, title: string, deletedBy: string): Promise<void> {
  await sendWhatsAppMessage(phone,
    `❌ *${eventType} abgesagt: ${title}*\n👤 Gelöscht von ${deletedBy}\n\n_🤖 Next Phantoms HQ_`);
}

export async function sendAttendanceReminder(phone: string, eventType: string, title: string, date: string): Promise<void> {
  await sendWhatsAppMessage(phone,
    `🗳️ *Erinnerung: ${title}*\nTyp: ${eventType}\n📅 ${date}\n\nBitte stimme ab ob du dabei bist!\n\n_🤖 Next Phantoms HQ_`);
}

export async function sendAnnouncementNotification(phone: string, title: string, createdBy: string): Promise<void> {
  await sendWhatsAppMessage(phone,
    `📣 *Neue Ankündigung: ${title}*\n👤 Von ${createdBy}\n\nLogge dich ein um die Ankündigung zu lesen.\n\n_🤖 Next Phantoms HQ_`);
}

export async function sendPollResultNotification(phone: string, question: string, resultsText: string): Promise<void> {
  await sendWhatsAppMessage(phone,
    `📊 *Abstimmung beendet: ${question}*\n\n${resultsText}\n\n_🤖 Next Phantoms HQ_`);
}
