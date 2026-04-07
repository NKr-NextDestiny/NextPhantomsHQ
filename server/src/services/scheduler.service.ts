import cron from "node-cron";
import { prisma } from "../config/prisma.js";
import { sendAttendanceReminder } from "./email.service.js";
import { config } from "../config/index.js";

export function startScheduler() {
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const reminders = await prisma.eventReminder.findMany({
        where: { scheduledAt: { lte: now }, sentAt: null },
      });

      for (const reminder of reminders) {
        try {
          let title = "Event";
          let date = now;
          if (reminder.eventType === "TRAINING") {
            const t = await prisma.training.findUnique({ where: { id: reminder.eventId }, include: { team: true } });
            if (t) { title = t.title; date = t.date; }
          } else if (reminder.eventType === "SCRIM") {
            const s = await prisma.scrim.findUnique({ where: { id: reminder.eventId }, include: { team: true } });
            if (s) { title = `Scrim vs ${s.opponent}`; date = s.date; }
          }

          const teamId = reminder.eventType === "TRAINING"
            ? (await prisma.training.findUnique({ where: { id: reminder.eventId } }))?.teamId
            : (await prisma.scrim.findUnique({ where: { id: reminder.eventId } }))?.teamId;

          if (teamId) {
            const members = await prisma.teamMember.findMany({
              where: { teamId },
              include: { user: { select: { id: true, email: true, emailNotifications: true } } },
            });

            for (const member of members) {
              if (!member.user?.email || !member.user.emailNotifications) continue;

              const team = await prisma.team.findUnique({ where: { id: teamId } });
              let token: string | undefined;
              if (team?.autoEmailEvents) {
                const at = await prisma.attendanceToken.upsert({
                  where: { userId_eventType_eventId: { userId: member.user.id, eventType: reminder.eventType, eventId: reminder.eventId } },
                  update: {},
                  create: { userId: member.user.id, eventType: reminder.eventType, eventId: reminder.eventId, expiresAt: date },
                });
                token = at.token;
              }

              sendAttendanceReminder(member.user.email, reminder.eventType, title, date.toLocaleString("de-DE"), token, config.appUrl).catch(console.error);
            }
          }

          await prisma.eventReminder.update({ where: { id: reminder.id }, data: { sentAt: now } });
        } catch (e) {
          console.error("[scheduler] Error processing reminder:", e);
        }
      }
    } catch (e) {
      console.error("[scheduler] Error:", e);
    }
  });
  console.log("⏰ Scheduler started");
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
