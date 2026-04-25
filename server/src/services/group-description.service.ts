import { prisma } from "../config/prisma.js";
import { logger } from "../config/logger.js";
import { config } from "../config/index.js";
import * as evolutionService from "./evolution.service.js";

const DESCRIPTION_LIMIT = 2048;

interface GroupDescriptionBlockRecord {
  id: string;
  content: string;
  position: "ABOVE" | "BELOW";
  sortOrder: number;
  teamId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface VoteRecord {
  status: string;
  comment: string | null;
  user: { displayName: string };
}

const groupDescriptionBlockDelegate = (prisma as unknown as {
  groupDescriptionBlock: {
    findMany(args: unknown): Promise<GroupDescriptionBlockRecord[]>;
  };
}).groupDescriptionBlock;

const timers = new Map<string, NodeJS.Timeout>();

function normalizeLocale(locale?: string | null) {
  if (locale === "en" || locale === "pirate") return locale;
  return "de";
}

function formatDate(date: Date | null | undefined, locale: string) {
  if (!date) return locale === "en" ? "No date" : "Kein Datum";
  return date.toLocaleString(locale === "en" ? "en-GB" : "de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function clipDescription(text: string) {
  if (text.length <= DESCRIPTION_LIMIT) return text;
  return `${text.slice(0, DESCRIPTION_LIMIT - 3).trimEnd()}...`;
}

async function getUpcomingTeamItems(teamId: string) {
  const now = new Date();
  const [trainings, matches, polls, blocks] = await Promise.all([
    prisma.training.findMany({
      where: { teamId, date: { gte: now } },
      orderBy: { date: "asc" },
      take: 4,
      include: {
        votes: {
          include: { user: { select: { displayName: true } } },
        },
      },
    }),
    prisma.match.findMany({
      where: { teamId, date: { gte: now } },
      orderBy: { date: "asc" },
      take: 4,
      include: {
        votes: {
          include: { user: { select: { displayName: true } } },
        },
      },
    }),
    prisma.poll.findMany({
      where: {
        teamId,
        OR: [{ deadline: null }, { deadline: { gte: now } }],
      },
      include: {
        options: {
          include: { _count: { select: { votes: true } } },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    groupDescriptionBlockDelegate.findMany({
      where: { teamId },
      orderBy: [{ position: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return { trainings, matches, polls, blocks };
}

function formatVotes(votes: VoteRecord[], totalMembers: number, locale: string) {
  const available = votes.filter((vote) => vote.status === "AVAILABLE");
  const unavailable = votes.filter((vote) => vote.status === "UNAVAILABLE");
  const maybe = votes.filter((vote) => vote.status === "MAYBE");
  const outstanding = Math.max(totalMembers - available.length - unavailable.length - maybe.length, 0);

  const unavailableReasons = unavailable
    .filter((vote) => vote.comment)
    .map((vote) => `- ${vote.user.displayName}: ${vote.comment}`);
  const maybeReasons = maybe
    .filter((vote) => vote.comment)
    .map((vote) => `- ${vote.user.displayName}: ${vote.comment}`);

  const lines = locale === "en"
    ? [`Available: ${available.length}`, `Unavailable: ${unavailable.length}`, `Maybe: ${maybe.length}`, `Pending: ${outstanding}`]
    : [`Zusagen: ${available.length}`, `Absagen: ${unavailable.length}`, `Vielleicht: ${maybe.length}`, `Ausstehend: ${outstanding}`];

  if (unavailableReasons.length > 0) {
    lines.push(locale === "en" ? "Reasons (unavailable):" : "Absagegründe:");
    lines.push(...unavailableReasons);
  }
  if (maybeReasons.length > 0) {
    lines.push(locale === "en" ? "Reasons (maybe):" : "Vielleicht-Gründe:");
    lines.push(...maybeReasons);
  }

  return lines.join("\n");
}

export async function buildGroupDescription(teamId: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return "";

  const locale = normalizeLocale(team.whatsappLanguage);
  const memberCount = await prisma.teamMember.count({ where: { teamId } });
  const { trainings, matches, polls, blocks } = await getUpcomingTeamItems(teamId);

  const mergedEvents = [
    ...trainings.map((training) => ({
      kind: locale === "en" ? "Training" : "Training",
      title: training.title,
      date: training.date,
      notes: training.notes,
      votes: training.votes as VoteRecord[],
    })),
    ...matches.map((match) => ({
      kind: match.type === "SCRIM" ? "Scrim" : "Match",
      title: `${match.type === "SCRIM" ? "Scrim" : "Match"} vs ${match.opponent}`,
      date: match.date,
      notes: [match.competition, match.map, match.notes].filter(Boolean).join(" | ") || null,
      votes: match.votes as VoteRecord[],
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const current = mergedEvents[0];
  const upcoming = mergedEvents.slice(1, 4);
  const above = blocks.filter((block) => block.position === "ABOVE").map((block) => block.content.trim()).filter(Boolean);
  const below = blocks.filter((block) => block.position === "BELOW").map((block) => block.content.trim()).filter(Boolean);

  const parts: string[] = [];

  if (above.length > 0) parts.push(above.join("\n\n"));

  if (current) {
    parts.push(locale === "en" ? `📅 Next Event\n${current.kind}: ${current.title}\n${formatDate(current.date, locale)}` : `📅 Nächster Termin\n${current.kind}: ${current.title}\n${formatDate(current.date, locale)}`);
    if (current.notes) parts.push(`📝 ${locale === "en" ? "Info" : "Info"}\n${current.notes}`);
    parts.push(`📌 Status\n${formatVotes(current.votes, memberCount, locale)}`);
  } else {
    parts.push(locale === "en" ? "📅 Next Event\nThere is currently no upcoming event scheduled." : "📅 Nächster Termin\nAktuell ist kein kommender Termin eingetragen.");
  }

  if (polls.length > 0) {
    const pollLines = polls.map((poll) => {
      const totalVotes = poll.options.reduce((sum, option) => sum + option._count.votes, 0);
      return `- ${poll.question} (${totalVotes} ${locale === "en" ? "votes" : "Stimmen"}${poll.deadline ? `${locale === "en" ? ", until " : ", bis "}${formatDate(poll.deadline, locale)}` : ""})`;
    });
    parts.push(locale === "en" ? `📊 Open Polls\n${pollLines.join("\n")}` : `📊 Offene Umfragen\n${pollLines.join("\n")}`);
  }

  if (upcoming.length > 0) {
    const lines = upcoming.map((event) => `- ${event.kind}: ${event.title} | ${formatDate(event.date, locale)}`);
    parts.push(locale === "en" ? `⏭️ After That\n${lines.join("\n")}` : `⏭️ Danach\n${lines.join("\n")}`);
  }

  if (below.length > 0) parts.push(below.join("\n\n"));

  parts.push(locale === "en" ? "🤖 Automatically maintained by Next Phantoms HQ" : "🤖 Automatisch gepflegt von Next Phantoms HQ");
  return clipDescription(parts.join("\n\n").trim());
}

export async function updateGroupDescription(teamId: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team?.whatsappGroupJid || !config.evolutionInstance) return;

  const description = await buildGroupDescription(teamId);
  try {
    await evolutionService.updateGroupDescription(config.evolutionInstance, team.whatsappGroupJid, description);
  } catch (error) {
    logger.error(error, "[Evolution] Failed to update group description");
  }
}

export function scheduleGroupDescriptionUpdate(teamId: string, delayMs = 1500) {
  const existing = timers.get(teamId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    timers.delete(teamId);
    void updateGroupDescription(teamId);
  }, delayMs);

  timers.set(teamId, timer);
}
