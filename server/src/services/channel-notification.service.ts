import path from "node:path";
import { prisma } from "../config/prisma.js";
import { config } from "../config/index.js";
import * as emailService from "./email.service.js";
import * as evolutionService from "./evolution.service.js";
import { createAnnouncementImage, createMatchResultImage, createPollResultImage } from "./notification-image.service.js";
import { readDecryptedFile } from "./file-encryption.service.js";
import { logger } from "../config/logger.js";

type ContentMode = "TEXT" | "IMAGE" | "BOTH";

const AUTOMATED_NOTICE = "Dies ist eine automatisierte Nachricht von Next Phantoms HQ.";

interface NotifyMember {
  id: string;
  email?: string | null;
  phone?: string | null;
  emailNotifications: boolean;
}

interface TeamNotificationSettings {
  emailNotificationsEnabled: boolean;
  whatsappNotificationsEnabled: boolean;
  whatsappGroupJid: string | null;
  announcementNotificationMode: ContentMode;
  matchResultNotificationMode: ContentMode;
  pollResultNotificationMode: ContentMode;
}

function inferMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

async function loadEncryptedImage(imageUrl: string, fileName?: string | null) {
  const diskPath = path.resolve(config.uploadDir, path.basename(imageUrl));
  const data = readDecryptedFile(diskPath);
  return {
    data,
    fileName: fileName || path.basename(imageUrl),
    mimetype: inferMimeType(fileName || imageUrl),
  };
}

type MediaPayload = Awaited<ReturnType<typeof createAnnouncementImage>> | Awaited<ReturnType<typeof loadEncryptedImage>>;

async function getSettings(teamId: string): Promise<TeamNotificationSettings> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      emailNotificationsEnabled: true,
      whatsappNotificationsEnabled: true,
      whatsappGroupJid: true,
      announcementNotificationMode: true,
      matchResultNotificationMode: true,
      pollResultNotificationMode: true,
    },
  });

  return {
    emailNotificationsEnabled: team?.emailNotificationsEnabled ?? true,
    whatsappNotificationsEnabled: team?.whatsappNotificationsEnabled ?? false,
    whatsappGroupJid: team?.whatsappGroupJid ?? null,
    announcementNotificationMode: (team?.announcementNotificationMode as ContentMode) || "TEXT",
    matchResultNotificationMode: (team?.matchResultNotificationMode as ContentMode) || "TEXT",
    pollResultNotificationMode: (team?.pollResultNotificationMode as ContentMode) || "TEXT",
  };
}

async function getRecipients(teamId: string): Promise<NotifyMember[]> {
  const members = await prisma.teamMember.findMany({
    where: { teamId },
    include: { user: { select: { id: true, email: true, phone: true, emailNotifications: true } } },
  });
  return members.map((member) => ({
    id: member.user.id,
    email: member.user.email,
    phone: member.user.phone,
    emailNotifications: member.user.emailNotifications,
  }));
}

async function sendEmails(members: NotifyMember[], enabled: boolean, fn: (email: string) => Promise<void>) {
  if (!enabled) return;
  await Promise.all(
    members
      .filter((member) => member.emailNotifications && member.email)
      .map((member) => fn(member.email!).catch((e) => logger.error(e, "Failed to send email notification"))),
  );
}

async function sendGroupWhatsapp(
  settings: TeamNotificationSettings,
  text: string,
  mode: ContentMode,
  media?: MediaPayload | null,
) {
  if (!settings.whatsappNotificationsEnabled || !settings.whatsappGroupJid) return;
  await evolutionService.sendWhatsAppNotification(
    settings.whatsappGroupJid,
    `${text}\n\n${AUTOMATED_NOTICE}`,
    mode,
    media,
  );
}

export function getAvailableChannels(): { email: boolean; whatsapp: boolean } {
  return {
    email: Boolean(config.smtpHost && config.smtpUser),
    whatsapp: evolutionService.isEvolutionConfigured(),
  };
}

export async function notifyNewEvent(teamId: string, eventType: string, title: string, date: string, createdBy: string): Promise<void> {
  const settings = await getSettings(teamId);
  const members = await getRecipients(teamId);
  const text = `📅 Neues ${eventType}: ${title}\n${date}\nVon ${createdBy}\n\n${AUTOMATED_NOTICE}`;

  await sendEmails(members, settings.emailNotificationsEnabled, (email) =>
    emailService.sendNewEventNotification(email, eventType, title, date, createdBy),
  );
  await sendGroupWhatsapp(settings, text, "TEXT");
}

export async function notifyEventUpdated(teamId: string, eventType: string, title: string, date: string, updatedBy: string): Promise<void> {
  const settings = await getSettings(teamId);
  const members = await getRecipients(teamId);
  const text = `🔄 ${eventType} aktualisiert: ${title}\n${date}\nGeändert von ${updatedBy}\n\n${AUTOMATED_NOTICE}`;

  await sendEmails(members, settings.emailNotificationsEnabled, (email) =>
    emailService.sendEventUpdatedNotification(email, eventType, title, date, updatedBy),
  );
  await sendGroupWhatsapp(settings, text, "TEXT");
}

export async function notifyEventDeleted(teamId: string, eventType: string, title: string, deletedBy: string): Promise<void> {
  const settings = await getSettings(teamId);
  const members = await getRecipients(teamId);
  const text = `❌ ${eventType} abgesagt: ${title}\nVon ${deletedBy}\n\n${AUTOMATED_NOTICE}`;

  await sendEmails(members, settings.emailNotificationsEnabled, (email) =>
    emailService.sendEventDeletedNotification(email, eventType, title, deletedBy),
  );
  await sendGroupWhatsapp(settings, text, "TEXT");
}

export async function notifyAnnouncement(teamId: string, announcementId: string): Promise<void> {
  const settings = await getSettings(teamId);
  const members = await getRecipients(teamId);
  const announcement = await prisma.announcement.findUnique({
    where: { id: announcementId },
    include: { createdBy: { select: { displayName: true } } },
  });
  if (!announcement) return;

  const text = `📣 Neue Ankündigung: ${announcement.title}\nVon ${announcement.createdBy.displayName}\n\n${announcement.content}\n\n${AUTOMATED_NOTICE}`;
  const media = announcement.imageUrl
    ? await loadEncryptedImage(announcement.imageUrl, announcement.imageFileName)
    : await createAnnouncementImage({
        title: announcement.title,
        content: announcement.content,
        createdBy: announcement.createdBy.displayName,
      });

  await sendEmails(members, settings.emailNotificationsEnabled, (email) =>
    emailService.sendAnnouncementNotification(email, announcement.title, announcement.createdBy.displayName),
  );
  await sendGroupWhatsapp(settings, text, settings.announcementNotificationMode, media);
}

export async function notifyMatchResult(teamId: string, matchId: string): Promise<void> {
  const settings = await getSettings(teamId);
  const members = await getRecipients(teamId);
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || match.scoreUs === null || match.scoreThem === null || !match.result) return;

  const text = `🏆 Match-Ergebnis\nNext Phantoms ${match.scoreUs}:${match.scoreThem} ${match.opponent}\n${match.result}\n${match.map || "Ohne Map"}\n${match.competition || "Ohne Wettbewerb"}\n\n${AUTOMATED_NOTICE}`;
  const media = await createMatchResultImage({
    opponent: match.opponent,
    scoreUs: match.scoreUs,
    scoreThem: match.scoreThem,
    map: match.map,
    competition: match.competition,
    result: match.result,
  });

  await sendEmails(members, settings.emailNotificationsEnabled, (email) =>
    emailService.sendMatchResultNotification(email, match.opponent, match.scoreUs!, match.scoreThem!, match.result!, match.map, match.competition),
  );
  await sendGroupWhatsapp(settings, text, settings.matchResultNotificationMode, media);
}

export async function notifyPollResults(teamId: string, pollId: string): Promise<void> {
  const settings = await getSettings(teamId);
  const members = await getRecipients(teamId);
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      options: {
        include: { _count: { select: { votes: true } } },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!poll) return;

  const totalVotes = poll.options.reduce((sum, option) => sum + option._count.votes, 0);
  const resultLines = poll.options.map((option) => {
    const percent = totalVotes > 0 ? Math.round((option._count.votes / totalVotes) * 100) : 0;
    return `${option.text}: ${option._count.votes} Stimmen (${percent}%)`;
  });
  const text = `📊 Abstimmung beendet: ${poll.question}\n\n${resultLines.join("\n")}\n\n${AUTOMATED_NOTICE}`;
  const media = await createPollResultImage({ question: poll.question, lines: resultLines });

  await sendEmails(members, settings.emailNotificationsEnabled, (email) =>
    emailService.sendPollResultNotification(email, poll.question, resultLines),
  );
  await sendGroupWhatsapp(settings, text, settings.pollResultNotificationMode, media);

  await prisma.poll.update({ where: { id: poll.id }, data: { resultsSentAt: new Date() } });
}

export async function notifyPollCreated(teamId: string, pollId: string): Promise<void> {
  const settings = await getSettings(teamId);
  const members = await getRecipients(teamId);
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      createdBy: { select: { displayName: true } },
      options: { orderBy: { order: "asc" } },
    },
  });
  if (!poll) return;

  const optionLines = poll.options.map((option, index) => `${index + 1}. ${option.text}`);
  const text = `📊 Neue Umfrage: ${poll.question}\nVon ${poll.createdBy.displayName}\n\n${optionLines.join("\n")}\n\n${AUTOMATED_NOTICE}`;

  await sendEmails(members, settings.emailNotificationsEnabled, (email) =>
    emailService.sendEmail(
      email,
      `[Next Phantoms HQ] Neue Umfrage: ${poll.question}`,
      `<p><strong>${poll.createdBy.displayName}</strong> hat eine neue Umfrage erstellt.</p><p><strong>${poll.question}</strong></p><ul>${poll.options.map((option) => `<li>${option.text}</li>`).join("")}</ul><p>Öffne das HQ zum Abstimmen.</p><p><em>${AUTOMATED_NOTICE}</em></p>`,
    ),
  );
  await sendGroupWhatsapp(settings, text, "TEXT");
}

export async function notifyReminderCreated(teamId: string, title: string, content?: string | null) {
  const settings = await getSettings(teamId);
  const text = `🔔 Neue Erinnerung: ${title}${content ? `\n\n${content}` : ""}\n\n${AUTOMATED_NOTICE}`;
  await sendGroupWhatsapp(settings, text, "TEXT");
}

export async function notifyReminderUpdated(teamId: string, title: string, content?: string | null) {
  const settings = await getSettings(teamId);
  const text = `🔄 Erinnerung aktualisiert: ${title}${content ? `\n\n${content}` : ""}\n\n${AUTOMATED_NOTICE}`;
  await sendGroupWhatsapp(settings, text, "TEXT");
}

export async function notifyReminderDeleted(teamId: string, title: string) {
  const settings = await getSettings(teamId);
  const text = `❌ Erinnerung gelöscht: ${title}\n\n${AUTOMATED_NOTICE}`;
  await sendGroupWhatsapp(settings, text, "TEXT");
}

export async function sendPrivateAttendanceReminder(
  teamId: string,
  member: NotifyMember,
  eventType: string,
  title: string,
  date: string,
  emailToken?: string,
  whatsappToken?: string,
  existingResponse?: string | null,
  existingReason?: string | null,
): Promise<void> {
  const settings = await getSettings(teamId);
  const baseText = `⏰ Automatisierte Erinnerung: ${title}\nTyp: ${eventType}\n${date}\n\nBitte gib deine Verfügbarkeit an.`;

  const tasks: Promise<void>[] = [];

  if (settings.emailNotificationsEnabled && member.emailNotifications && member.email && emailToken) {
    tasks.push(
      existingResponse
        ? emailService.sendAttendanceAlreadyResponded(
            member.email,
            eventType,
            title,
            date,
            existingResponse,
            existingReason,
          )
        : emailService.sendAttendanceReminder(
            member.email,
            eventType,
            title,
            date,
            emailToken,
            config.appUrl,
          ),
    );
  }

  if (settings.whatsappNotificationsEnabled && member.phone && whatsappToken) {
    tasks.push(
      evolutionService.sendWhatsAppText(
        member.phone,
        `${baseText}\n${config.appUrl}/attendance/${whatsappToken}\n\n${AUTOMATED_NOTICE}`,
        "private",
      ),
    );
  }

  await Promise.all(tasks);
}
