import cron from "node-cron";
import { prisma } from "../config/prisma.js";
import * as channelNotify from "./channel-notification.service.js";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";

export function startScheduler() {
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
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
            const channel = await channelNotify.getChannel(teamId);
            if (channel !== "NONE") {
              const members = await prisma.teamMember.findMany({
                where: { teamId },
                include: { user: { select: { id: true, email: true, phone: true, emailNotifications: true } } },
              });

              const team = trainings.find(t => t.teamId === teamId)?.team
                || matches.find(m => m.teamId === teamId)?.team;

              const promises: Promise<void>[] = [];

              for (const member of members) {
                if (!member.user.emailNotifications) continue;

                let token: string | undefined;
                if (channel === "EMAIL" && team?.autoEmailEvents) {
                  const at = await prisma.attendanceToken.upsert({
                    where: { userId_eventType_eventId: { userId: member.user.id, eventType: reminder.eventType, eventId: reminder.eventId } },
                    update: {},
                    create: { userId: member.user.id, eventType: reminder.eventType, eventId: reminder.eventId, expiresAt: date },
                  });
                  token = at.token;
                }

                promises.push(
                  channelNotify.sendAttendanceReminder(channel, member.user, reminder.eventType, title, date.toLocaleString("de-DE"), token, config.appUrl)
                    .catch(e => logger.error(e, "Failed to send reminder"))
                );
              }

              await Promise.all(promises);
            }
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
