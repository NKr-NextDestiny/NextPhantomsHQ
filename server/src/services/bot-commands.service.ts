import { prisma } from "../config/prisma.js";
import { logger } from "../config/logger.js";
import * as evolutionService from "./evolution.service.js";

const AUTOMATED_NOTICE = "Dies ist eine automatisierte Nachricht von Next Phantoms HQ.";

export interface BotCommandDefinition {
  command: string;
  description: string;
}

export const BOT_COMMANDS: BotCommandDefinition[] = [
  { command: "!hilfe", description: "Zeigt diese Befehlsübersicht an." },
  { command: "!befehle", description: "Zeigt diese Befehlsübersicht an." },
  { command: "!nächstes / !naechstes", description: "Zeigt das nächste Training oder Match mit Details." },
  { command: "!termine", description: "Zeigt die nächsten anstehenden Termine." },
  { command: "!umfragen", description: "Zeigt aktuell offene Umfragen mit Deadline." },
  { command: "!ankündigungen / !ankuendigungen", description: "Zeigt die neuesten aktiven Ankündigungen." },
  { command: "!status", description: "Zeigt eine kompakte Zusammenfassung aus nächstem Termin und offenen Umfragen." },
];

async function getTeam(teamId?: string) {
  return prisma.team.findFirst({
    where: teamId ? { id: teamId } : undefined,
    orderBy: { createdAt: "asc" },
  });
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "Kein Datum";
  return value.toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function getUpcomingEvents(teamId: string, limit = 5) {
  const now = new Date();
  const [trainings, matches] = await Promise.all([
    prisma.training.findMany({
      where: { teamId, date: { gte: now } },
      orderBy: { date: "asc" },
      take: limit,
    }),
    prisma.match.findMany({
      where: { teamId, date: { gte: now } },
      orderBy: { date: "asc" },
      take: limit,
    }),
  ]);

  return [
    ...trainings.map((training) => ({
      kind: "Training",
      title: training.title,
      date: training.date,
      subtitle: training.notes,
    })),
    ...matches.map((match) => ({
      kind: match.type === "SCRIM" ? "Scrim" : "Match",
      title: `${match.type === "SCRIM" ? "Scrim" : "Match"} vs ${match.opponent}`,
      date: match.date,
      subtitle: [match.competition, match.map, match.notes].filter(Boolean).join(" | ") || null,
    })),
  ]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, limit);
}

export async function formatCommandHelpMessage() {
  const lines = BOT_COMMANDS.map((entry) => `• ${entry.command}\n  ${entry.description}`);
  return `🤖 *Next Phantoms HQ Bot-Befehle*\n\n${lines.join("\n\n")}\n\n📌 Alle Antworten kommen direkt aus dem HQ.\n\n${AUTOMATED_NOTICE}`;
}

export async function postCommandHelpToGroup(teamId?: string, customMessage?: string) {
  const team = await getTeam(teamId);
  if (!team?.whatsappGroupJid) {
    throw new Error("No WhatsApp group configured");
  }

  const message = customMessage?.trim() || await formatCommandHelpMessage();
  await evolutionService.sendWhatsAppText(team.whatsappGroupJid, message, "group");
}

async function formatNextEvent(teamId: string) {
  const [nextEvent] = await getUpcomingEvents(teamId, 1);
  if (!nextEvent) {
    return `Aktuell ist kein kommender Termin eingetragen.\n\n${AUTOMATED_NOTICE}`;
  }

  const detail = nextEvent.subtitle ? `\n${nextEvent.subtitle}` : "";
  return `📅 Nächster Termin\n${nextEvent.kind}: ${nextEvent.title}\n${formatDate(nextEvent.date)}${detail}\n\n${AUTOMATED_NOTICE}`;
}

async function formatUpcomingEvents(teamId: string) {
  const events = await getUpcomingEvents(teamId, 5);
  if (events.length === 0) {
    return `Aktuell sind keine kommenden Termine eingetragen.\n\n${AUTOMATED_NOTICE}`;
  }

  const lines = events.map((event, index) => `${index + 1}. ${event.kind}: ${event.title}\n   ${formatDate(event.date)}`);
  return `📆 Kommende Termine\n\n${lines.join("\n")}\n\n${AUTOMATED_NOTICE}`;
}

async function formatActivePolls(teamId: string) {
  const polls = await prisma.poll.findMany({
    where: {
      teamId,
      OR: [{ deadline: null }, { deadline: { gte: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  if (polls.length === 0) {
    return `Aktuell gibt es keine offenen Umfragen.\n\n${AUTOMATED_NOTICE}`;
  }

  const lines = polls.map((poll, index) => {
    const deadline = poll.deadline ? ` bis ${formatDate(poll.deadline)}` : " ohne Deadline";
    const desc = poll.description ? `\n   ${poll.description}` : "";
    return `${index + 1}. ${poll.question}${deadline}${desc}`;
  });
  return `📊 Offene Umfragen\n\n${lines.join("\n")}\n\n${AUTOMATED_NOTICE}`;
}

async function formatAnnouncements(teamId: string) {
  const announcements = await prisma.announcement.findMany({
    where: {
      teamId,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 3,
  });

  if (announcements.length === 0) {
    return `Aktuell gibt es keine aktiven Ankündigungen.\n\n${AUTOMATED_NOTICE}`;
  }

  const lines = announcements.map((announcement, index) => {
    const pin = announcement.pinned ? " [PIN]" : "";
    return `${index + 1}. ${announcement.title}${pin}\n   ${announcement.content}`;
  });
  return `📣 Aktuelle Ankündigungen\n\n${lines.join("\n")}\n\n${AUTOMATED_NOTICE}`;
}

async function formatStatus(teamId: string) {
  const [nextMessage, polls] = await Promise.all([
    formatNextEvent(teamId),
    prisma.poll.count({
      where: {
        teamId,
        OR: [{ deadline: null }, { deadline: { gte: new Date() } }],
      },
    }),
  ]);

  return `📌 Status\n${nextMessage.replace(`\n\n${AUTOMATED_NOTICE}`, "")}\nOffene Umfragen: ${polls}\n\n${AUTOMATED_NOTICE}`;
}

function extractCommand(text: string) {
  return text
    .normalize("NFC")
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/Ã¤/g, "ae")
    .replace(/Ã¶/g, "oe")
    .replace(/Ã¼/g, "ue")
    .replace(/ÃŸ/g, "ss") || "";
}

export async function handleIncomingGroupCommand(instanceName: string, remoteJid: string, text: string) {
  const team = await getTeam();
  if (!team?.whatsappGroupJid || remoteJid !== team.whatsappGroupJid || !text.startsWith("!")) {
    return;
  }

  let response: string | null = null;
  switch (extractCommand(text)) {
    case "!hilfe":
    case "!befehle":
      response = await formatCommandHelpMessage();
      break;
    case "!naechstes":
      response = await formatNextEvent(team.id);
      break;
    case "!termine":
      response = await formatUpcomingEvents(team.id);
      break;
    case "!umfragen":
      response = await formatActivePolls(team.id);
      break;
    case "!ankuendigungen":
      response = await formatAnnouncements(team.id);
      break;
    case "!status":
      response = await formatStatus(team.id);
      break;
    default:
      response = null;
  }

  if (!response) return;

  try {
    await evolutionService.sendWhatsAppText(remoteJid, response, "group");
  } catch (error) {
    logger.error(error, `[Evolution] Failed to answer command ${text}`);
  }
}
