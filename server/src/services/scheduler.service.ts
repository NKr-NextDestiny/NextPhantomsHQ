import cron from "node-cron";
import { prisma } from "../config/prisma.js";
import * as channelNotify from "./channel-notification.service.js";
import { logger } from "../config/logger.js";

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

          if (teamId) {
            const members = await prisma.teamMember.findMany({
              where: { teamId },
              include: { user: { select: { id: true, email: true, phone: true, emailNotifications: true } } },
            });

            const linkExpiry = new Date(now.getTime() + 5 * 60 * 1000);

            const promises = members.map(async (member) => {
              let emailToken: string | undefined;
              let whatsappToken: string | undefined;
              let existingResponse: string | null = null;
              let existingReason: string | null = null;

              if (reminder.eventType === "TRAINING") {
                const vote = await prisma.trainingVote.findUnique({
                  where: {
                    userId_trainingId: {
                      userId: member.user.id,
                      trainingId: reminder.eventId,
                    },
                  },
                  select: { status: true, comment: true },
                });
                existingResponse = vote?.status ?? null;
                existingReason = vote?.comment ?? null;
              } else if (reminder.eventType === "MATCH") {
                const vote = await prisma.matchVote.findUnique({
                  where: {
                    userId_matchId: {
                      userId: member.user.id,
                      matchId: reminder.eventId,
                    },
                  },
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
                      eventType: reminder.eventType,
                      eventId: reminder.eventId,
                      channel: "EMAIL",
                    },
                  },
                  update: { expiresAt: linkExpiry },
                  create: {
                    userId: member.user.id,
                    eventType: reminder.eventType,
                    eventId: reminder.eventId,
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
                      eventType: reminder.eventType,
                      eventId: reminder.eventId,
                      channel: "WHATSAPP",
                    },
                  },
                  update: { expiresAt: linkExpiry },
                  create: {
                    userId: member.user.id,
                    eventType: reminder.eventType,
                    eventId: reminder.eventId,
                    channel: "WHATSAPP",
                    expiresAt: linkExpiry,
                  },
                });
                whatsappToken = whatsappAttendance.token;
              }

              return channelNotify.sendPrivateAttendanceReminder(
                teamId,
                member.user,
                reminder.eventType,
                title,
                date.toLocaleString("de-DE"),
                emailToken,
                whatsappToken,
                existingResponse,
                existingReason,
              ).catch((e) => logger.error(e, "Failed to send reminder"));
            });

            await Promise.all(promises);
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
