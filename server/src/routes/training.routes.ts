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
import { sendNewEventNotification } from "../services/email.service.js";
import { createEventReminders, updateEventReminders } from "../services/scheduler.service.js";
import { getIO } from "../config/socket.js";

export const trainingRouter = Router();

const createSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(["RANKED", "CUSTOM", "AIM_TRAINING", "VOD_REVIEW", "STRAT_PRACTICE", "OTHER"]),
  date: z.string().transform(s => new Date(s)),
  endDate: z.string().transform(s => new Date(s)).optional().nullable(),
  recurrence: z.enum(["NONE", "DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"]).optional(),
  notes: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  reminderIntervals: z.array(z.number()).optional(),
});

const updateSchema = createSchema.partial();

const voteSchema = z.object({
  status: z.enum(["AVAILABLE", "UNAVAILABLE", "MAYBE"]),
  comment: z.string().optional().nullable(),
});

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
      where: { id: req.params.id },
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
    const team = await prisma.team.findUnique({ where: { id: req.teamId! } });
    const intervals = data.reminderIntervals ?? team?.defaultReminderIntervals ?? [];

    const training = await prisma.training.create({
      data: {
        title: data.title,
        type: data.type,
        date: data.date,
        endDate: data.endDate || null,
        recurrence: data.recurrence || "NONE",
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

    await notifyTeam({
      type: "TRAINING_CREATED",
      title: "Neues Training",
      message: `${req.user!.displayName} hat "${training.title}" erstellt`,
      link: `/training/${training.id}`,
      teamId: req.teamId!,
      actorId: req.user!.id,
    });

    // Send email notifications
    const members = await prisma.teamMember.findMany({
      where: { teamId: req.teamId! },
      include: { user: { select: { email: true, emailNotifications: true, id: true } } },
    });
    for (const m of members) {
      if (m.user.id !== req.user!.id && m.user.email && m.user.emailNotifications) {
        sendNewEventNotification(m.user.email, "Training", training.title, training.date.toLocaleString("de-DE"), req.user!.displayName).catch(console.error);
      }
    }

    await logAudit(req.user!.id, "CREATE", "training", training.id, { title: training.title }, req.teamId);

    try { getIO().to(`team:${req.teamId}`).emit("training:created", training); } catch {}

    res.status(201).json({ success: true, data: training });
  } catch (error) { next(error); }
});

// Update training
trainingRouter.put("/:id", authenticate, teamContext, requireFeature("training"), requireTeamRole("COACH"), validate(updateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.training.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Training not found");

    const data = req.body;
    const training = await prisma.training.update({
      where: { id: req.params.id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.date !== undefined && { date: data.date }),
        ...(data.endDate !== undefined && { endDate: data.endDate }),
        ...(data.recurrence !== undefined && { recurrence: data.recurrence }),
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

    await logAudit(req.user!.id, "UPDATE", "training", training.id, undefined, req.teamId);
    try { getIO().to(`team:${req.teamId}`).emit("training:updated", training); } catch {}

    res.json({ success: true, data: training });
  } catch (error) { next(error); }
});

// Delete training
trainingRouter.delete("/:id", authenticate, teamContext, requireFeature("training"), requireTeamRole("COACH"), async (req, res, next) => {
  try {
    const existing = await prisma.training.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Training not found");

    await prisma.eventReminder.deleteMany({ where: { eventType: "TRAINING", eventId: req.params.id } });
    await prisma.training.delete({ where: { id: req.params.id } });

    await logAudit(req.user!.id, "DELETE", "training", req.params.id, { title: existing.title }, req.teamId);
    try { getIO().to(`team:${req.teamId}`).emit("training:deleted", { id: req.params.id }); } catch {}

    res.json({ success: true, message: "Training deleted" });
  } catch (error) { next(error); }
});

// Vote
trainingRouter.post("/:id/vote", authenticate, teamContext, requireFeature("training"), validate(voteSchema), async (req, res, next) => {
  try {
    const training = await prisma.training.findUnique({ where: { id: req.params.id } });
    if (!training || training.teamId !== req.teamId) throw new AppError(404, "Training not found");

    const vote = await prisma.trainingVote.upsert({
      where: { userId_trainingId: { userId: req.user!.id, trainingId: req.params.id } },
      update: { status: req.body.status, comment: req.body.comment || null },
      create: { userId: req.user!.id, trainingId: req.params.id, status: req.body.status, comment: req.body.comment || null },
      include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
    });

    try { getIO().to(`team:${req.teamId}`).emit("training:vote", { trainingId: req.params.id, vote }); } catch {}

    res.json({ success: true, data: vote });
  } catch (error) { next(error); }
});

// Retract vote
trainingRouter.delete("/:id/vote", authenticate, teamContext, requireFeature("training"), async (req, res, next) => {
  try {
    await prisma.trainingVote.deleteMany({ where: { userId: req.user!.id, trainingId: req.params.id } });
    try { getIO().to(`team:${req.teamId}`).emit("training:vote:retracted", { trainingId: req.params.id, userId: req.user!.id }); } catch {}
    res.json({ success: true, message: "Vote retracted" });
  } catch (error) { next(error); }
});

// Attendance stats
trainingRouter.get("/:id/attendance", authenticate, teamContext, requireFeature("training"), async (req, res, next) => {
  try {
    const training = await prisma.training.findUnique({ where: { id: req.params.id } });
    if (!training || training.teamId !== req.teamId) throw new AppError(404, "Training not found");

    const votes = await prisma.trainingVote.findMany({
      where: { trainingId: req.params.id },
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
