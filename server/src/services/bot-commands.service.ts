import { prisma } from "../config/prisma.js";
import { logger } from "../config/logger.js";
import * as evolutionService from "./evolution.service.js";

const AUTOMATED_NOTICE = "Dies ist eine automatisierte Nachricht von Next Phantoms HQ.";

type TeamLocale = "de" | "en" | "pirate";

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

function localeForTeam(team?: { whatsappLanguage?: string | null }): TeamLocale {
  if (team?.whatsappLanguage === "en" || team?.whatsappLanguage === "pirate") return team.whatsappLanguage;
  return "de";
}

function automatedNotice(locale: TeamLocale) {
  if (locale === "en") return "This is an automated message from Next Phantoms HQ.";
  if (locale === "pirate") return "Dies ist eine automatisierte Flaschenpost von Next Phantoms HQ.";
  return AUTOMATED_NOTICE;
}

function formatDate(value: Date | null | undefined, locale: TeamLocale) {
  if (!value) return locale === "en" ? "No date" : "Kein Datum";
  return value.toLocaleString(locale === "en" ? "en-GB" : "de-DE", {
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

export async function formatCommandHelpMessage(teamId?: string) {
  const team = await getTeam(teamId);
  const locale = localeForTeam(team ?? undefined);
  const lines = BOT_COMMANDS.map((entry) => `• ${entry.command}\n  ${entry.description}`);
  if (locale === "en") {
    return `🤖 *Next Phantoms HQ Bot Commands*\n\n${lines.join("\n\n")}\n\n📌 All answers come straight from HQ.\n\n${automatedNotice(locale)}`;
  }
  return `🤖 *Next Phantoms HQ Bot-Befehle*\n\n${lines.join("\n\n")}\n\n📌 Alle Antworten kommen direkt aus dem HQ.\n\n${automatedNotice(locale)}`;
}

export async function postCommandHelpToGroup(teamId?: string, customMessage?: string) {
  const team = await getTeam(teamId);
  if (!team?.whatsappGroupJid) {
    throw new Error("No WhatsApp group configured");
  }

  const message = customMessage?.trim() || await formatCommandHelpMessage(team.id);
  await evolutionService.sendWhatsAppText(team.whatsappGroupJid, message, "group");
}

async function formatNextEvent(teamId: string, locale: TeamLocale) {
  const [nextEvent] = await getUpcomingEvents(teamId, 1);
  if (!nextEvent) {
    return locale === "en"
      ? `There is currently no upcoming event scheduled.\n\n${automatedNotice(locale)}`
      : `Aktuell ist kein kommender Termin eingetragen.\n\n${automatedNotice(locale)}`;
  }

  const detail = nextEvent.subtitle ? `\n${nextEvent.subtitle}` : "";
  return locale === "en"
    ? `📅 Next Event\n${nextEvent.kind}: ${nextEvent.title}\n${formatDate(nextEvent.date, locale)}${detail}\n\n${automatedNotice(locale)}`
    : `📅 Nächster Termin\n${nextEvent.kind}: ${nextEvent.title}\n${formatDate(nextEvent.date, locale)}${detail}\n\n${automatedNotice(locale)}`;
}

async function formatUpcomingEvents(teamId: string, locale: TeamLocale) {
  const events = await getUpcomingEvents(teamId, 5);
  if (events.length === 0) {
    return locale === "en"
      ? `There are currently no upcoming events.\n\n${automatedNotice(locale)}`
      : `Aktuell sind keine kommenden Termine eingetragen.\n\n${automatedNotice(locale)}`;
  }

  const lines = events.map((event, index) => `${index + 1}. ${event.kind}: ${event.title}\n   ${formatDate(event.date, locale)}`);
  return locale === "en"
    ? `📆 Upcoming Events\n\n${lines.join("\n")}\n\n${automatedNotice(locale)}`
    : `📆 Kommende Termine\n\n${lines.join("\n")}\n\n${automatedNotice(locale)}`;
}

async function formatActivePolls(teamId: string, locale: TeamLocale) {
  const polls = await prisma.poll.findMany({
    where: {
      teamId,
      OR: [{ deadline: null }, { deadline: { gte: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  if (polls.length === 0) {
    return locale === "en"
      ? `There are currently no open polls.\n\n${automatedNotice(locale)}`
      : `Aktuell gibt es keine offenen Umfragen.\n\n${automatedNotice(locale)}`;
  }

  const lines = polls.map((poll, index) => {
    const deadline = poll.deadline
      ? (locale === "en" ? ` until ${formatDate(poll.deadline, locale)}` : ` bis ${formatDate(poll.deadline, locale)}`)
      : locale === "en"
        ? " without deadline"
        : " ohne Deadline";
    const desc = poll.description ? `\n   ${poll.description}` : "";
    return `${index + 1}. ${poll.question}${deadline}${desc}`;
  });
  return locale === "en"
    ? `📊 Open Polls\n\n${lines.join("\n")}\n\n${automatedNotice(locale)}`
    : `📊 Offene Umfragen\n\n${lines.join("\n")}\n\n${automatedNotice(locale)}`;
}

async function formatAnnouncements(teamId: string, locale: TeamLocale) {
  const announcements = await prisma.announcement.findMany({
    where: {
      teamId,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 3,
  });

  if (announcements.length === 0) {
    return locale === "en"
      ? `There are currently no active announcements.\n\n${automatedNotice(locale)}`
      : `Aktuell gibt es keine aktiven Ankündigungen.\n\n${automatedNotice(locale)}`;
  }

  const lines = announcements.map((announcement, index) => {
    const pin = announcement.pinned ? " [PIN]" : "";
    return `${index + 1}. ${announcement.title}${pin}\n   ${announcement.content}`;
  });
  return locale === "en"
    ? `📣 Current Announcements\n\n${lines.join("\n")}\n\n${automatedNotice(locale)}`
    : `📣 Aktuelle Ankündigungen\n\n${lines.join("\n")}\n\n${automatedNotice(locale)}`;
}

async function formatStatus(teamId: string, locale: TeamLocale) {
  const [nextMessage, polls] = await Promise.all([
    formatNextEvent(teamId, locale),
    prisma.poll.count({
      where: {
        teamId,
        OR: [{ deadline: null }, { deadline: { gte: new Date() } }],
      },
    }),
  ]);

  return locale === "en"
    ? `📌 Status\n${nextMessage.replace(`\n\n${automatedNotice(locale)}`, "")}\nOpen polls: ${polls}\n\n${automatedNotice(locale)}`
    : `📌 Status\n${nextMessage.replace(`\n\n${automatedNotice(locale)}`, "")}\nOffene Umfragen: ${polls}\n\n${automatedNotice(locale)}`;
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

export async function handleIncomingGroupCommand(_instanceName: string, remoteJid: string, text: string) {
  const team = await getTeam();
  if (!team?.whatsappGroupJid || remoteJid !== team.whatsappGroupJid || !text.startsWith("!")) {
    return;
  }
  const locale = localeForTeam(team);

  let response: string | null = null;
  switch (extractCommand(text)) {
    case "!hilfe":
    case "!befehle":
      response = await formatCommandHelpMessage(team.id);
      break;
    case "!naechstes":
      response = await formatNextEvent(team.id, locale);
      break;
    case "!termine":
      response = await formatUpcomingEvents(team.id, locale);
      break;
    case "!umfragen":
      response = await formatActivePolls(team.id, locale);
      break;
    case "!ankuendigungen":
      response = await formatAnnouncements(team.id, locale);
      break;
    case "!status":
      response = await formatStatus(team.id, locale);
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
