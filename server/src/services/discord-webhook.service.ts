import { config } from "../config/index.js";
import { prisma } from "../config/prisma.js";

interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

interface DiscordEmbed {
  title: string;
  description?: string;
  color?: number;
  fields?: EmbedField[];
  footer?: { text: string };
  timestamp?: string;
}

export async function sendWebhookNotification(embed: DiscordEmbed): Promise<void> {
  const team = await prisma.team.findFirst();
  const webhookUrl = team?.discordWebhookUrl || config.discordWebhookUrl;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Next Phantoms HQ",
        embeds: [{ ...embed, footer: embed.footer ?? { text: "Next Phantoms HQ" }, timestamp: embed.timestamp ?? new Date().toISOString() }],
      }),
    });
  } catch (err) {
    console.error("[Webhook] Failed to send:", err);
  }
}

export function buildMatchEmbed(data: { opponent: string; map?: string | null; result?: string | null; scoreUs?: number | null; scoreThem?: number | null; competition?: string | null; type?: string }): DiscordEmbed {
  const isScrim = data.type === "SCRIM";
  const color = isScrim ? 0x3b82f6 : data.result === "WIN" ? 0x22c55e : data.result === "LOSS" ? 0xef4444 : 0xf59e0b;
  const title = isScrim ? `Scrim: vs ${data.opponent}` : `Match: ${data.result ?? "Geplant"} vs ${data.opponent}`;
  const fields: EmbedField[] = [];
  if (data.map) fields.push({ name: "Map", value: data.map, inline: true });
  if (data.scoreUs != null && data.scoreThem != null) fields.push({ name: "Score", value: `${data.scoreUs} - ${data.scoreThem}`, inline: true });
  if (data.competition) fields.push({ name: "Competition", value: data.competition, inline: true });
  return { title, color, fields };
}

export function buildTrainingEmbed(data: { title: string; type: string; date: string }): DiscordEmbed {
  return {
    title: `Training: ${data.title}`,
    color: 0xf97316,
    fields: [
      { name: "Typ", value: data.type, inline: true },
      { name: "Datum", value: new Date(data.date).toLocaleString("de-DE"), inline: true },
    ],
  };
}

