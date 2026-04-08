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
import { sendNewEventNotification, sendEventUpdatedNotification, sendEventDeletedNotification } from "../services/email.service.js";
import { createEventReminders, updateEventReminders } from "../services/scheduler.service.js";
import { safeEmit } from "../config/socket.js";
import { sendWebhookNotification, buildScrimEmbed } from "../services/discord-webhook.service.js";

export const scrimRouter = Router();

const createSchema = z.object({
  opponent: z.string().min(1).max(200),
  meetTime: z.string().transform(s => new Date(s)).optional().nullable(),
  date: z.string().transform(s => new Date(s)),
  endDate: z.string().transform(s => new Date(s)).optional().nullable(),
  mapPool: z.array(z.string()).optional().default([]),
  format: z.string().optional().nullable(),
  contactInfo: z.string().optional().nullable(),
  serverRegion: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  recurrence: z.enum(["NONE", "DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"]).optional(),
  reminderIntervals: z.array(z.number()).optional(),
});

const updateSchema = createSchema.partial();

const voteSchema = z.object({
  status: z.enum(["AVAILABLE", "UNAVAILABLE", "MAYBE"]),
  comment: z.string().optional().nullable(),
});

const resultSchema = z.object({
  scoreUs: z.number().int().min(0),
  scoreThem: z.number().int().min(0),
  maps: z.any().optional().nullable(),
  notes: z.string().optional().nullable(),
  skillRating: z.number().int().min(1).max(5).optional().nullable(),
  communicationRating: z.number().int().min(1).max(5).optional().nullable(),
  punctualityRating: z.number().int().min(1).max(5).optional().nullable(),
});

// List scrims
scrimRouter.get("/", authenticate, teamContext, requireFeature("scrims"), async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const where: any = { teamId: req.teamId };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from as string);
      if (to) where.date.lte = new Date(to as string);
    }

    const scrims = await prisma.scrim.findMany({
      where,
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
        votes: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
        result: true,
      },
      orderBy: { date: "asc" },
    });

    res.json({ success: true, data: scrims });
  } catch (error) { next(error); }
});

// Get single scrim
scrimRouter.get("/:id", authenticate, teamContext, requireFeature("scrims"), async (req, res, next) => {
  try {
    const scrim = await prisma.scrim.findUnique({
      where: { id: String(req.params.id) },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
        votes: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
        result: true,
        matches: true,
      },
    });
    if (!scrim || scrim.teamId !== req.teamId) throw new AppError(404, "Scrim not found");
    res.json({ success: true, data: scrim });
  } catch (error) { next(error); }
});

// Create scrim
scrimRouter.post("/", authenticate, teamContext, requireFeature("scrims"), requireTeamRole("COACH"), validate(createSchema), async (req, res, next) => {
  try {
    const data = req.body;
    const team = await prisma.team.findUnique({ where: { id: req.teamId! } });
    const intervals = data.reminderIntervals ?? team?.defaultReminderIntervals ?? [];

    const scrim = await prisma.scrim.create({
      data: {
        opponent: data.opponent,
        meetTime: data.meetTime || null,
        date: data.date,
        endDate: data.endDate || null,
        mapPool: data.mapPool,
        format: data.format || null,
        contactInfo: data.contactInfo || null,
        serverRegion: data.serverRegion || null,
        notes: data.notes || null,
        recurrence: data.recurrence || "NONE",
        reminderIntervals: intervals,
        createdById: req.user!.id,
        teamId: req.teamId!,
      },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
        votes: true,
        result: true,
      },
    });

    if (intervals.length > 0) {
      await createEventReminders("SCRIM", scrim.id, scrim.date, intervals, req.teamId!);
    }

    await notifyTeam({
      type: "SCRIM_CREATED",
      title: "Neues Scrim",
      message: `${req.user!.displayName} hat ein Scrim vs ${scrim.opponent} erstellt`,
      link: `/scrims/${scrim.id}`,
      teamId: req.teamId!,
      actorId: req.user!.id,
    });

    const members = await prisma.teamMember.findMany({
      where: { teamId: req.teamId! },
      include: { user: { select: { email: true, emailNotifications: true, id: true } } },
    });
    await Promise.all(
      members
        .filter(m => m.user.id !== req.user!.id && m.user.email && m.user.emailNotifications)
        .map(m => sendNewEventNotification(m.user.email, "Scrim", `Scrim vs ${scrim.opponent}`, scrim.date.toLocaleString("de-DE"), req.user!.displayName).catch(console.error))
    );

    await logAudit(req.user!.id, "CREATE", "scrim", scrim.id, { opponent: scrim.opponent }, req.teamId);
    safeEmit(`team:${req.teamId}`, "scrim:created", scrim);
    sendWebhookNotification(buildScrimEmbed({ opponent: scrim.opponent, date: scrim.date.toISOString(), format: scrim.format || undefined })).catch(console.error);

    res.status(201).json({ success: true, data: scrim });
  } catch (error) { next(error); }
});

// Update scrim
scrimRouter.put("/:id", authenticate, teamContext, requireFeature("scrims"), requireTeamRole("COACH"), validate(updateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.scrim.findUnique({ where: { id: String(req.params.id) } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Scrim not found");

    const data = req.body;
    const scrim = await prisma.scrim.update({
      where: { id: String(req.params.id) },
      data: {
        ...(data.opponent !== undefined && { opponent: data.opponent }),
        ...(data.date !== undefined && { date: data.date }),
        ...(data.endDate !== undefined && { endDate: data.endDate }),
        ...(data.mapPool !== undefined && { mapPool: data.mapPool }),
        ...(data.format !== undefined && { format: data.format }),
        ...(data.contactInfo !== undefined && { contactInfo: data.contactInfo }),
        ...(data.serverRegion !== undefined && { serverRegion: data.serverRegion }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.recurrence !== undefined && { recurrence: data.recurrence }),
        ...(data.reminderIntervals !== undefined && { reminderIntervals: data.reminderIntervals }),
      },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
        votes: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
        result: true,
      },
    });

    if (data.date || data.reminderIntervals) {
      await updateEventReminders("SCRIM", scrim.id, scrim.date, scrim.reminderIntervals, req.teamId!);
    }

    await logAudit(req.user!.id, "UPDATE", "scrim", scrim.id, undefined, req.teamId);
    safeEmit(`team:${req.teamId}`, "scrim:updated", scrim);

    const updateMembers = await prisma.teamMember.findMany({
      where: { teamId: req.teamId! },
      include: { user: { select: { email: true, emailNotifications: true, id: true } } },
    });
    await Promise.all(
      updateMembers
        .filter(m => m.user.id !== req.user!.id && m.user.email && m.user.emailNotifications)
        .map(m => sendEventUpdatedNotification(m.user.email, "Scrim", `Scrim vs ${scrim.opponent}`, scrim.date.toLocaleString("de-DE"), req.user!.displayName).catch(console.error))
    );

    res.json({ success: true, data: scrim });
  } catch (error) { next(error); }
});

// Delete scrim
scrimRouter.delete("/:id", authenticate, teamContext, requireFeature("scrims"), requireTeamRole("COACH"), async (req, res, next) => {
  try {
    const existing = await prisma.scrim.findUnique({ where: { id: String(req.params.id) } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Scrim not found");

    await prisma.eventReminder.deleteMany({ where: { eventType: "SCRIM", eventId: String(req.params.id) } });

    const deleteMembers = await prisma.teamMember.findMany({
      where: { teamId: req.teamId! },
      include: { user: { select: { email: true, emailNotifications: true, id: true } } },
    });
    await Promise.all(
      deleteMembers
        .filter(m => m.user.id !== req.user!.id && m.user.email && m.user.emailNotifications)
        .map(m => sendEventDeletedNotification(m.user.email, "Scrim", existing.opponent, req.user!.displayName).catch(console.error))
    );

    await prisma.scrim.delete({ where: { id: String(req.params.id) } });

    await logAudit(req.user!.id, "DELETE", "scrim", String(req.params.id), { opponent: existing.opponent }, req.teamId);
    safeEmit(`team:${req.teamId}`, "scrim:deleted", { id: String(req.params.id) });

    res.json({ success: true, message: "Scrim deleted" });
  } catch (error) { next(error); }
});

// Vote
scrimRouter.post("/:id/vote", authenticate, teamContext, requireFeature("scrims"), validate(voteSchema), async (req, res, next) => {
  try {
    const scrim = await prisma.scrim.findUnique({ where: { id: String(req.params.id) } });
    if (!scrim || scrim.teamId !== req.teamId) throw new AppError(404, "Scrim not found");

    const vote = await prisma.scrimVote.upsert({
      where: { userId_scrimId: { userId: req.user!.id, scrimId: String(req.params.id) } },
      update: { status: req.body.status, comment: req.body.comment || null },
      create: { userId: req.user!.id, scrimId: String(req.params.id), status: req.body.status, comment: req.body.comment || null },
      include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
    });

    safeEmit(`team:${req.teamId}`, "scrim:vote", { scrimId: String(req.params.id), vote });

    res.json({ success: true, data: vote });
  } catch (error) { next(error); }
});

// Retract vote
scrimRouter.delete("/:id/vote", authenticate, teamContext, requireFeature("scrims"), async (req, res, next) => {
  try {
    await prisma.scrimVote.deleteMany({ where: { userId: req.user!.id, scrimId: String(req.params.id) } });
    safeEmit(`team:${req.teamId}`, "scrim:vote:retracted", { scrimId: String(req.params.id), userId: req.user!.id });
    res.json({ success: true, message: "Vote retracted" });
  } catch (error) { next(error); }
});

// Log result
scrimRouter.post("/:id/result", authenticate, teamContext, requireFeature("scrims"), requireTeamRole("COACH"), validate(resultSchema), async (req, res, next) => {
  try {
    const scrim = await prisma.scrim.findUnique({ where: { id: String(req.params.id) } });
    if (!scrim || scrim.teamId !== req.teamId) throw new AppError(404, "Scrim not found");

    const result = await prisma.scrimResult.upsert({
      where: { scrimId: String(req.params.id) },
      update: req.body,
      create: { ...req.body, scrimId: String(req.params.id) },
    });

    await logAudit(req.user!.id, "UPDATE", "scrim_result", result.id, undefined, req.teamId);
    safeEmit(`team:${req.teamId}`, "scrim:result", { scrimId: String(req.params.id), result });

    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

// Attendance stats
scrimRouter.get("/:id/attendance", authenticate, teamContext, requireFeature("scrims"), async (req, res, next) => {
  try {
    const scrim = await prisma.scrim.findUnique({ where: { id: String(req.params.id) } });
    if (!scrim || scrim.teamId !== req.teamId) throw new AppError(404, "Scrim not found");

    const votes = await prisma.scrimVote.findMany({
      where: { scrimId: String(req.params.id) },
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
