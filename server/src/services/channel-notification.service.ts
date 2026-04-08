import { prisma } from "../config/prisma.js";
import { config } from "../config/index.js";
import * as emailService from "./email.service.js";
import * as wahaService from "./waha.service.js";
import { logger } from "../config/logger.js";

type Channel = "NONE" | "EMAIL" | "WHATSAPP";

/** Get the team's configured notification channel. */
export async function getChannel(teamId: string): Promise<Channel> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { notificationChannel: true } });
  return (team?.notificationChannel as Channel) || "NONE";
}

/** Returns which channels have their env vars configured. */
export function getAvailableChannels(): { email: boolean; whatsapp: boolean } {
  return {
    email: Boolean(config.smtpHost && config.smtpUser),
    whatsapp: wahaService.isWahaConfigured(),
  };
}

interface NotifyMember {
  email?: string | null;
  phone?: string | null;
  emailNotifications: boolean;
}

/** Send a notification to a single member based on channel. */
async function sendToMember(
  channel: Channel,
  member: NotifyMember,
  emailFn: (email: string) => Promise<void>,
  wahaFn: (phone: string) => Promise<void>,
): Promise<void> {
  if (!member.emailNotifications) return;

  if (channel === "EMAIL" && member.email) {
    await emailFn(member.email);
  } else if (channel === "WHATSAPP" && member.phone) {
    await wahaFn(member.phone);
  }
}

/** Send new event notification to all team members. */
export async function notifyNewEvent(teamId: string, eventType: string, title: string, date: string, createdBy: string): Promise<void> {
  const channel = await getChannel(teamId);
  if (channel === "NONE") return;

  const members = await prisma.teamMember.findMany({
    where: { teamId },
    include: { user: { select: { email: true, phone: true, emailNotifications: true } } },
  });

  const promises = members.map(m =>
    sendToMember(channel, m.user,
      (email) => emailService.sendNewEventNotification(email, eventType, title, date, createdBy),
      (phone) => wahaService.sendNewEventNotification(phone, eventType, title, date, createdBy),
    ).catch(e => logger.error(e, "Failed to send new event notification"))
  );
  await Promise.all(promises);
}

/** Send event updated notification to all team members. */
export async function notifyEventUpdated(teamId: string, eventType: string, title: string, date: string, updatedBy: string): Promise<void> {
  const channel = await getChannel(teamId);
  if (channel === "NONE") return;

  const members = await prisma.teamMember.findMany({
    where: { teamId },
    include: { user: { select: { email: true, phone: true, emailNotifications: true } } },
  });

  const promises = members.map(m =>
    sendToMember(channel, m.user,
      (email) => emailService.sendEventUpdatedNotification(email, eventType, title, date, updatedBy),
      (phone) => wahaService.sendEventUpdatedNotification(phone, eventType, title, date, updatedBy),
    ).catch(e => logger.error(e, "Failed to send event update notification"))
  );
  await Promise.all(promises);
}

/** Send event deleted notification to all team members. */
export async function notifyEventDeleted(teamId: string, eventType: string, title: string, deletedBy: string): Promise<void> {
  const channel = await getChannel(teamId);
  if (channel === "NONE") return;

  const members = await prisma.teamMember.findMany({
    where: { teamId },
    include: { user: { select: { email: true, phone: true, emailNotifications: true } } },
  });

  const promises = members.map(m =>
    sendToMember(channel, m.user,
      (email) => emailService.sendEventDeletedNotification(email, eventType, title, deletedBy),
      (phone) => wahaService.sendEventDeletedNotification(phone, eventType, title, deletedBy),
    ).catch(e => logger.error(e, "Failed to send event delete notification"))
  );
  await Promise.all(promises);
}

/** Send attendance reminder to a single member. */
export async function sendAttendanceReminder(
  channel: Channel,
  member: NotifyMember,
  eventType: string,
  title: string,
  date: string,
  token?: string,
  appUrl?: string,
): Promise<void> {
  await sendToMember(channel, member,
    (email) => emailService.sendAttendanceReminder(email, eventType, title, date, token, appUrl),
    (phone) => wahaService.sendAttendanceReminder(phone, eventType, title, date),
  );
}

/** Send announcement notification to all team members. */
export async function notifyAnnouncement(teamId: string, title: string, createdBy: string): Promise<void> {
  const channel = await getChannel(teamId);
  if (channel === "NONE") return;

  const members = await prisma.teamMember.findMany({
    where: { teamId },
    include: { user: { select: { email: true, phone: true, emailNotifications: true } } },
  });

  const promises = members.map(m =>
    sendToMember(channel, m.user,
      (email) => emailService.sendAnnouncementNotification(email, title, createdBy),
      (phone) => wahaService.sendAnnouncementNotification(phone, title, createdBy),
    ).catch(e => logger.error(e, "Failed to send announcement notification"))
  );
  await Promise.all(promises);
}
