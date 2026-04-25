import cron from "node-cron";
import { prisma } from "../config/prisma.js";
import * as channelNotify from "./channel-notification.service.js";
import { logger } from "../config/logger.js";

type AttendanceEventType = "TRAINING" | "MATCH";

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function buildAttendanceWindow(
  eventDate: Date,
  openHoursBefore: number,
  closeHoursBefore: number,
  activateNow = false,
) {
  const now = new Date();
  const opensAt = activateNow ? now : new Date(eventDate.getTime() - openHoursBefore * 60 * 60 * 1000);
  const closesAt = new Date(eventDate.getTime() - closeHoursBefore * 60 * 60 * 1000);
  return {
    opensAt,
    closesAt: closesAt > opensAt ? closesAt : eventDate,
    activatedAt: activateNow ? now : null,
    openedNotificationSentAt: activateNow ? now : null,
  };
}

export function buildRecurringDates(startDate: Date, recurrence: string, count = 8) {
  const dates: Date[] = [];
  let cursor = new Date(startDate);
  for (let i = 1; i < count; i++) {
    if (recurrence === "DAILY") cursor = addDays(cursor, 1);
    else if (recurrence === "WEEKLY") cursor = addDays(cursor, 7);
    else if (recurrence === "BIWEEKLY") cursor = addDays(cursor, 14);
    else if (recurrence === "MONTHLY") {
      const next = new Date(cursor);
      next.setMonth(next.getMonth() + 1);
      cursor = next;
    } else {
      break;
    }
    dates.push(new Date(cursor));
  }
  return dates;
}

async function deliverAttendanceInvite(
  teamId: string,
  eventType: AttendanceEventType,
  eventId: string,
  title: string,
  date: Date,
) {
  const members = await prisma.teamMember.findMany({
    where: { teamId },
    include: { user: { select: { id: true, email: true, phone: true, emailNotifications: true, language: true } } },
  });

  const now = new Date();
  const linkExpiry = new Date(now.getTime() + 5 * 60 * 1000);
  const formattedDate = date.toLocaleString("de-DE");

  await Promise.all(
    members.map(async (member) => {
      let emailToken: string | undefined;
      let whatsappToken: string | undefined;
      let existingResponse: string | null = null;
      let existingReason: string | null = null;

      if (eventType === "TRAINING") {
        const vote = await prisma.trainingVote.findUnique({
          where: { userId_trainingId: { userId: member.user.id, trainingId: eventId } },
          select: { status: true, comment: true },
        });
        existingResponse = vote?.status ?? null;
        existingReason = vote?.comment ?? null;
      } else {
        const vote = await prisma.matchVote.findUnique({
          where: { userId_matchId: { userId: member.user.id, matchId: eventId } },
          select: { status: true, comment: true },
        });
        existingResponse = vote?.status ?? null;
        existingReason = vote?.comment ?? null;
      }

      if (member.user.email) {
        const emailAttendance = await prisma.attendanceToken.upsert({
          where: {
            userId_eventType_eventId_channel: {
              userId: member.user.id,
              eventType,
              eventId,
              channel: "EMAIL",
            },
          },
          update: { expiresAt: linkExpiry },
          create: {
            userId: member.user.id,
            eventType,
            eventId,
            channel: "EMAIL",
            expiresAt: linkExpiry,
          },
        });
        emailToken = emailAttendance.token;
      }

      if (member.user.phone) {
        const whatsappAttendance = await prisma.attendanceToken.upsert({
          where: {
            userId_eventType_eventId_channel: {
              userId: member.user.id,
              eventType,
              eventId,
              channel: "WHATSAPP",
            },
          },
          update: { expiresAt: linkExpiry },
          create: {
            userId: member.user.id,
            eventType,
            eventId,
            channel: "WHATSAPP",
            expiresAt: linkExpiry,
          },
        });
        whatsappToken = whatsappAttendance.token;
      }

      return channelNotify.sendPrivateAttendanceReminder(
        teamId,
        member.user,
        eventType,
        title,
        formattedDate,
        emailToken,
        whatsappToken,
        existingResponse,
        existingReason,
      ).catch((e) => logger.error(e, "Failed to send reminder"));
    }),
  );
}

export async function activateAttendanceForEvent(
  eventType: AttendanceEventType,
  eventId: string,
  force = false,
) {
  const now = new Date();
  if (eventType === "TRAINING") {
    const training = await prisma.training.findUnique({ where: { id: eventId } });
    if (!training) return;
    if (training.attendanceOpenedNotificationSentAt && !force) return;
    await deliverAttendanceInvite(training.teamId, "TRAINING", training.id, training.title, training.date);
    await prisma.training.update({
      where: { id: training.id },
      data: {
        attendanceActivatedAt: training.attendanceActivatedAt ?? now,
        attendanceOpenedNotificationSentAt: now,
        attendanceOpensAt: training.attendanceOpensAt ?? now,
      },
    });
    return;
  }

  const match = await prisma.match.findUnique({ where: { id: eventId } });
  if (!match) return;
  if (match.attendanceOpenedNotificationSentAt && !force) return;
  const title = match.type === "SCRIM" ? `Scrim vs ${match.opponent}` : `Match vs ${match.opponent}`;
  await deliverAttendanceInvite(match.teamId, "MATCH", match.id, title, match.date);
  await prisma.match.update({
    where: { id: match.id },
    data: {
      attendanceActivatedAt: match.attendanceActivatedAt ?? now,
      attendanceOpenedNotificationSentAt: now,
      attendanceOpensAt: match.attendanceOpensAt ?? now,
    },
  });
}

export function startScheduler() {
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();

      const expiredPolls = await prisma.poll.findMany({
        where: {
          deadline: { lte: now },
          resultsSentAt: null,
        },
        select: { id: true, teamId: true },
      });

      await Promise.all(
        expiredPolls.map((poll) =>
          channelNotify.notifyPollResults(poll.teamId, poll.id).catch((e) => logger.error(e, "Failed to send poll results")),
        ),
      );

      const [trainingsToOpen, matchesToOpen] = await Promise.all([
        prisma.training.findMany({
          where: {
            attendanceOpensAt: { lte: now },
            attendanceOpenedNotificationSentAt: null,
          },
          select: { id: true },
        }),
        prisma.match.findMany({
          where: {
            attendanceOpensAt: { lte: now },
            attendanceOpenedNotificationSentAt: null,
          },
          select: { id: true },
        }),
      ]);

      await Promise.all([
        ...trainingsToOpen.map((training) =>
          activateAttendanceForEvent("TRAINING", training.id).catch((e) => logger.error(e, "Failed to open training attendance")),
        ),
        ...matchesToOpen.map((match) =>
          activateAttendanceForEvent("MATCH", match.id).catch((e) => logger.error(e, "Failed to open match attendance")),
        ),
      ]);

      const reminders = await prisma.eventReminder.findMany({
        where: { scheduledAt: { lte: now }, sentAt: null },
      });

      if (reminders.length === 0) return;

      // Batch-load all referenced trainings and matches
      const trainingIds = reminders.filter(r => r.eventType === "TRAINING").map(r => r.eventId);
      const matchIds = reminders.filter(r => r.eventType === "MATCH").map(r => r.eventId);

      const [trainings, matches] = await Promise.all([
        trainingIds.length > 0
          ? prisma.training.findMany({ where: { id: { in: trainingIds } }, include: { team: true } })
          : [],
        matchIds.length > 0
          ? prisma.match.findMany({ where: { id: { in: matchIds } }, include: { team: true } })
          : [],
      ]);

      const trainingMap = new Map(trainings.map(t => [t.id, t]));
      const matchMap = new Map(matches.map(m => [m.id, m]));

      for (const reminder of reminders) {
        try {
          let title = "Event";
          let date = now;
          let teamId: string | undefined;

          if (reminder.eventType === "TRAINING") {
            const t = trainingMap.get(reminder.eventId);
            if (t) { title = t.title; date = t.date; teamId = t.teamId; }
          } else if (reminder.eventType === "MATCH") {
            const m = matchMap.get(reminder.eventId);
            if (m) {
              title = m.type === "SCRIM" ? `Scrim vs ${m.opponent}` : `Match vs ${m.opponent}`;
              date = m.date; teamId = m.teamId;
            }
          }

          if (teamId && (reminder.eventType === "TRAINING" || reminder.eventType === "MATCH")) {
            await deliverAttendanceInvite(teamId, reminder.eventType, reminder.eventId, title, date);
          }

          await prisma.eventReminder.update({ where: { id: reminder.id }, data: { sentAt: now } });
        } catch (e) {
          logger.error(e, "[scheduler] Error processing reminder");
        }
      }
    } catch (e) {
      logger.error(e, "[scheduler] Error");
    }
  });
  logger.info("Scheduler started");
}

export async function createEventReminders(eventType: string, eventId: string, eventDate: Date, intervals: number[], _teamId: string) {
  if (!intervals.length) return;
  const data = intervals.map(min => ({
    eventType,
    eventId,
    minutesBefore: min,
    scheduledAt: new Date(eventDate.getTime() - min * 60 * 1000),
  }));
  await prisma.eventReminder.createMany({ data });
}

export async function updateEventReminders(eventType: string, eventId: string, eventDate: Date, intervals: number[], teamId: string) {
  await prisma.eventReminder.deleteMany({ where: { eventType, eventId } });
  await createEventReminders(eventType, eventId, eventDate, intervals, teamId);
}
