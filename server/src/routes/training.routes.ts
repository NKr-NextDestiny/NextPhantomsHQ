import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { teamContext, requireTeamRole } from "../middleware/team.js";
import { requireFeature } from "../middleware/features.js";
import { validate } from "../middleware/validate.js";
import { AppError } from "../middleware/errorHandler.js";
import { logAudit } from "../services/audit.service.js";
import { notifyTeam } from "../services/notification.service.js";
import { sendWebhookNotification, buildTrainingEmbed } from "../services/discord-webhook.service.js";
import * as channelNotify from "../services/channel-notification.service.js";
import {
  activateAttendanceForEvent,
  buildAttendanceWindow,
  buildRecurringDates,
  createEventReminders,
  updateEventReminders,
} from "../services/scheduler.service.js";
import { safeEmit } from "../config/socket.js";
import { scheduleGroupDescriptionUpdate } from "../services/group-description.service.js";

export const trainingRouter = Router();

const createSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(["RANKED", "CUSTOM", "AIM_TRAINING", "VOD_REVIEW", "STRAT_PRACTICE", "OTHER"]),
  meetTime: z.string().transform(s => new Date(s)),
  date: z.string().transform(s => new Date(s)),
  endDate: z.string().transform(s => new Date(s)).optional().nullable(),
  recurrence: z.enum(["NONE", "DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"]).optional(),
  attendanceOpenHoursBefore: z.number().int().min(0).max(336).optional(),
  attendanceCloseHoursBefore: z.number().int().min(0).max(336).optional(),
  activateAttendanceNow: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  reminderIntervals: z.array(z.number()).optional(),
});

const updateSchema = createSchema.partial();

const voteSchema = z.object({
  status: z.enum(["AVAILABLE", "UNAVAILABLE", "MAYBE"]),
  comment: z.string().optional().nullable(),
});

function canVoteForEvent(opensAt?: Date | null, closesAt?: Date | null) {
  const now = new Date();
  if (opensAt && now < opensAt) return { allowed: false, error: "Die Abstimmung ist noch nicht geöffnet." };
  if (closesAt && now > closesAt) return { allowed: false, error: "Die Abstimmung ist bereits geschlossen." };
  return { allowed: true };
}

// List trainings
trainingRouter.get("/", authenticate, teamContext, requireFeature("training"), async (req, res, next) => {
  try {
    const { from, to, type } = req.query;
    const where: any = { teamId: req.teamId };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from as string);
      if (to) where.date.lte = new Date(to as string);
    }
    if (type) where.type = type;

    const trainings = await prisma.training.findMany({
      where,
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
        votes: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
      },
      orderBy: { date: "asc" },
    });

    res.json({ success: true, data: trainings });
  } catch (error) { next(error); }
});

// Get single training
trainingRouter.get("/:id", authenticate, teamContext, requireFeature("training"), async (req, res, next) => {
  try {
    const training = await prisma.training.findUnique({
      where: { id: String(req.params.id) },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
        votes: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
      },
    });
    if (!training || training.teamId !== req.teamId) throw new AppError(404, "Training not found");
    res.json({ success: true, data: training });
  } catch (error) { next(error); }
});

// Create training
trainingRouter.post("/", authenticate, teamContext, requireFeature("training"), requireTeamRole("COACH"), validate(createSchema), async (req, res, next) => {
  try {
    const data = req.body;
    const team = await prisma.team.findUnique({
      where: { id: req.teamId! },
      select: {
        defaultReminderIntervals: true,
        defaultAttendanceOpenHoursBefore: true,
        defaultAttendanceCloseHoursBefore: true,
      },
    });
    const intervals = data.reminderIntervals ?? team?.defaultReminderIntervals ?? [];
    const attendanceOpenHoursBefore = data.attendanceOpenHoursBefore ?? team?.defaultAttendanceOpenHoursBefore ?? 72;
    const attendanceCloseHoursBefore = data.attendanceCloseHoursBefore ?? team?.defaultAttendanceCloseHoursBefore ?? 2;
    const recurrence = data.recurrence || "NONE";
    const recurringDates = recurrence === "NONE" ? [] : buildRecurringDates(data.date, recurrence);

    const createdTrainings = [];
    const allDates = [data.date, ...recurringDates];
    for (const currentDate of allDates) {
      const meetOffset = data.date.getTime() - data.meetTime.getTime();
      const endOffset = data.endDate ? data.endDate.getTime() - data.date.getTime() : null;
      const attendanceWindow = buildAttendanceWindow(
        currentDate,
        attendanceOpenHoursBefore,
        attendanceCloseHoursBefore,
        Boolean(data.activateAttendanceNow),
      );

      const training = await prisma.training.create({
        data: {
          title: data.title,
          type: data.type,
          meetTime: new Date(currentDate.getTime() - meetOffset),
          date: currentDate,
          endDate: endOffset !== null ? new Date(currentDate.getTime() + endOffset) : null,
          recurrence,
          attendanceOpenHoursBefore,
          attendanceCloseHoursBefore,
          attendanceOpensAt: attendanceWindow.opensAt,
          attendanceClosesAt: attendanceWindow.closesAt,
          attendanceActivatedAt: attendanceWindow.activatedAt,
          attendanceOpenedNotificationSentAt: attendanceWindow.openedNotificationSentAt,
          notes: data.notes || null,
          location: data.location || null,
          reminderIntervals: intervals,
          createdById: req.user!.id,
          teamId: req.teamId!,
        },
        include: {
          createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
          votes: true,
        },
      });

      if (intervals.length > 0) {
        await createEventReminders("TRAINING", training.id, training.date, intervals, req.teamId!);
      }
      if (data.activateAttendanceNow) {
        await activateAttendanceForEvent("TRAINING", training.id, true);
      }
      createdTrainings.push(training);
    }
    const [training] = createdTrainings;

    await notifyTeam({
      type: "TRAINING_CREATED",
      title: "Neues Training",
      message: `${req.user!.displayName} hat "${training.title}" erstellt`,
      link: `/training/${training.id}`,
      teamId: req.teamId!,
      actorId: req.user!.id,
    });

    await Promise.all(
      createdTrainings.map((entry) =>
        channelNotify.notifyNewEvent(req.teamId!, "Training", entry.title, entry.date.toLocaleString("de-DE"), req.user!.displayName).catch(console.error),
      ),
    );

    await logAudit(req.user!.id, "CREATE", "training", training.id, { title: training.title }, req.teamId);

    safeEmit(`team:${req.teamId}`, "training:created", training);
    sendWebhookNotification(buildTrainingEmbed({ title: training.title, type: training.type, date: training.date.toISOString() })).catch(console.error);
    scheduleGroupDescriptionUpdate(req.teamId!);

    res.status(201).json({ success: true, data: training, createdCount: createdTrainings.length });
  } catch (error) { next(error); }
});

// Update training
trainingRouter.put("/:id", authenticate, teamContext, requireFeature("training"), requireTeamRole("COACH"), validate(updateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.training.findUnique({ where: { id: String(req.params.id) } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Training not found");

    const data = req.body;
    const training = await prisma.training.update({
      where: { id: String(req.params.id) },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.meetTime !== undefined && { meetTime: data.meetTime }),
        ...(data.date !== undefined && { date: data.date }),
        ...(data.endDate !== undefined && { endDate: data.endDate }),
        ...(data.recurrence !== undefined && { recurrence: data.recurrence }),
        ...(data.attendanceOpenHoursBefore !== undefined && { attendanceOpenHoursBefore: data.attendanceOpenHoursBefore }),
        ...(data.attendanceCloseHoursBefore !== undefined && { attendanceCloseHoursBefore: data.attendanceCloseHoursBefore }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.reminderIntervals !== undefined && { reminderIntervals: data.reminderIntervals }),
      },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
        votes: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
      },
    });

    if (data.date || data.reminderIntervals) {
      await updateEventReminders("TRAINING", training.id, training.date, training.reminderIntervals, req.teamId!);
    }

    if (data.date !== undefined || data.attendanceOpenHoursBefore !== undefined || data.attendanceCloseHoursBefore !== undefined) {
      const attendanceWindow = buildAttendanceWindow(
        training.date,
        training.attendanceOpenHoursBefore,
        training.attendanceCloseHoursBefore,
        false,
      );
      await prisma.training.update({
        where: { id: training.id },
        data: {
          attendanceOpensAt: attendanceWindow.opensAt,
          attendanceClosesAt: attendanceWindow.closesAt,
          attendanceOpenedNotificationSentAt: null,
        },
      });
    }

    if (data.activateAttendanceNow) {
      await activateAttendanceForEvent("TRAINING", training.id, true);
    }

    await logAudit(req.user!.id, "UPDATE", "training", training.id, undefined, req.teamId);
    safeEmit(`team:${req.teamId}`, "training:updated", training);
    scheduleGroupDescriptionUpdate(req.teamId!);

    channelNotify.notifyEventUpdated(req.teamId!, "Training", training.title, training.date.toLocaleString("de-DE"), req.user!.displayName).catch(console.error);

    res.json({ success: true, data: training });
  } catch (error) { next(error); }
});

// Delete training
trainingRouter.delete("/:id", authenticate, teamContext, requireFeature("training"), requireTeamRole("COACH"), async (req, res, next) => {
  try {
    const existing = await prisma.training.findUnique({ where: { id: String(req.params.id) } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Training not found");

    await prisma.eventReminder.deleteMany({ where: { eventType: "TRAINING", eventId: String(req.params.id) } });

    channelNotify.notifyEventDeleted(req.teamId!, "Training", existing.title, req.user!.displayName).catch(console.error);

    await prisma.training.delete({ where: { id: String(req.params.id) } });

    await logAudit(req.user!.id, "DELETE", "training", String(req.params.id), { title: existing.title }, req.teamId);
    safeEmit(`team:${req.teamId}`, "training:deleted", { id: String(req.params.id) });
    scheduleGroupDescriptionUpdate(req.teamId!);

    res.json({ success: true, message: "Training deleted" });
  } catch (error) { next(error); }
});

// Vote
trainingRouter.post("/:id/vote", authenticate, teamContext, requireFeature("training"), validate(voteSchema), async (req, res, next) => {
  try {
    const training = await prisma.training.findUnique({ where: { id: String(req.params.id) } });
    if (!training || training.teamId !== req.teamId) throw new AppError(404, "Training not found");
    const availability = canVoteForEvent(training.attendanceOpensAt, training.attendanceClosesAt);
    if (!availability.allowed) throw new AppError(409, availability.error!);

    const vote = await prisma.trainingVote.upsert({
      where: { userId_trainingId: { userId: req.user!.id, trainingId: String(req.params.id) } },
      update: { status: req.body.status, comment: req.body.comment || null },
      create: { userId: req.user!.id, trainingId: String(req.params.id), status: req.body.status, comment: req.body.comment || null },
      include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
    });

    safeEmit(`team:${req.teamId}`, "training:vote", { trainingId: String(req.params.id), vote });
    scheduleGroupDescriptionUpdate(req.teamId!);

    res.json({ success: true, data: vote });
  } catch (error) { next(error); }
});

trainingRouter.post("/:id/activate-attendance", authenticate, teamContext, requireFeature("training"), requireTeamRole("COACH"), async (req, res, next) => {
  try {
    const training = await prisma.training.findUnique({ where: { id: String(req.params.id) } });
    if (!training || training.teamId !== req.teamId) throw new AppError(404, "Training not found");
    await activateAttendanceForEvent("TRAINING", training.id, true);
    const refreshed = await prisma.training.findUnique({ where: { id: training.id } });
    res.json({ success: true, data: refreshed });
  } catch (error) { next(error); }
});

// Retract vote
trainingRouter.delete("/:id/vote", authenticate, teamContext, requireFeature("training"), async (req, res, next) => {
  try {
    await prisma.trainingVote.deleteMany({ where: { userId: req.user!.id, trainingId: String(req.params.id) } });
    safeEmit(`team:${req.teamId}`, "training:vote:retracted", { trainingId: String(req.params.id), userId: req.user!.id });
    scheduleGroupDescriptionUpdate(req.teamId!);
    res.json({ success: true, message: "Vote retracted" });
  } catch (error) { next(error); }
});

// Attendance stats
trainingRouter.get("/:id/attendance", authenticate, teamContext, requireFeature("training"), async (req, res, next) => {
  try {
    const training = await prisma.training.findUnique({ where: { id: String(req.params.id) } });
    if (!training || training.teamId !== req.teamId) throw new AppError(404, "Training not found");

    const votes = await prisma.trainingVote.findMany({
      where: { trainingId: String(req.params.id) },
      include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
    });
    const members = await prisma.teamMember.findMany({
      where: { teamId: req.teamId! },
      include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
    });

    const votedUserIds = new Set(votes.map(v => v.userId));
    const noResponse = members.filter(m => !votedUserIds.has(m.userId)).map(m => m.user);

    res.json({
      success: true,
      data: {
        available: votes.filter(v => v.status === "AVAILABLE"),
        unavailable: votes.filter(v => v.status === "UNAVAILABLE"),
        maybe: votes.filter(v => v.status === "MAYBE"),
        noResponse,
      },
    });
  } catch (error) { next(error); }
});
