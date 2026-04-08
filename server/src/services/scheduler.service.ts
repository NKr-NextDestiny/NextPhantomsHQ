import cron from "node-cron";
import { prisma } from "../config/prisma.js";
import { sendAttendanceReminder } from "./email.service.js";
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

      // Batch-load all referenced trainings and scrims
      const trainingIds = reminders.filter(r => r.eventType === "TRAINING").map(r => r.eventId);
      const scrimIds = reminders.filter(r => r.eventType === "SCRIM").map(r => r.eventId);

      const [trainings, scrims] = await Promise.all([
        trainingIds.length > 0
          ? prisma.training.findMany({ where: { id: { in: trainingIds } }, include: { team: true } })
          : [],
        scrimIds.length > 0
          ? prisma.scrim.findMany({ where: { id: { in: scrimIds } }, include: { team: true } })
          : [],
      ]);

      const trainingMap = new Map(trainings.map(t => [t.id, t]));
      const scrimMap = new Map(scrims.map(s => [s.id, s]));

      for (const reminder of reminders) {
        try {
          let title = "Event";
          let date = now;
          let teamId: string | undefined;

          if (reminder.eventType === "TRAINING") {
            const t = trainingMap.get(reminder.eventId);
            if (t) { title = t.title; date = t.date; teamId = t.teamId; }
          } else if (reminder.eventType === "SCRIM") {
            const s = scrimMap.get(reminder.eventId);
            if (s) { title = `Scrim vs ${s.opponent}`; date = s.date; teamId = s.teamId; }
          }

          if (teamId) {
            const members = await prisma.teamMember.findMany({
              where: { teamId },
              include: { user: { select: { id: true, email: true, emailNotifications: true } } },
            });

            const team = trainings.find(t => t.teamId === teamId)?.team
              || scrims.find(s => s.teamId === teamId)?.team;

            const emailPromises: Promise<void>[] = [];

            for (const member of members) {
              if (!member.user?.email || !member.user.emailNotifications) continue;

              let token: string | undefined;
              if (team?.autoEmailEvents) {
                const at = await prisma.attendanceToken.upsert({
                  where: { userId_eventType_eventId: { userId: member.user.id, eventType: reminder.eventType, eventId: reminder.eventId } },
                  update: {},
                  create: { userId: member.user.id, eventType: reminder.eventType, eventId: reminder.eventId, expiresAt: date },
                });
                token = at.token;
              }

              emailPromises.push(
                sendAttendanceReminder(member.user.email, reminder.eventType, title, date.toLocaleString("de-DE"), token, config.appUrl).catch(e => logger.error(e, "Failed to send reminder email"))
              );
            }

            await Promise.all(emailPromises);
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
