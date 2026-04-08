import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { teamContext, requireTeamRole } from "../middleware/team.js";
import { requireFeature } from "../middleware/features.js";
import { validate } from "../middleware/validate.js";
import { AppError } from "../middleware/errorHandler.js";

export const reminderRouter = Router();

const reminderSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    content: z.string().max(5000).optional(),
    deadline: z.string().datetime().optional(),
  }),
});

// List reminders
reminderRouter.get("/", authenticate, teamContext, requireFeature("reminders"), async (req, res, next) => {
  try {
    const reminders = await prisma.reminder.findMany({
      where: { teamId: req.teamId! },
      include: { createdBy: { select: { id: true, displayName: true } } },
      orderBy: [{ done: "asc" }, { deadline: "asc" }, { createdAt: "desc" }],
    });
    res.json({ success: true, data: reminders });
  } catch (error) { next(error); }
});

// Create reminder (COACH+)
reminderRouter.post("/", authenticate, teamContext, requireFeature("reminders"), requireTeamRole("COACH"), validate(reminderSchema), async (req, res, next) => {
  try {
    const { title, content, deadline } = req.body;
    const reminder = await prisma.reminder.create({
      data: {
        title,
        content: content || null,
        deadline: deadline ? new Date(deadline) : null,
        teamId: req.teamId!,
        createdById: req.user!.id,
      },
      include: { createdBy: { select: { id: true, displayName: true } } },
    });
    res.status(201).json({ success: true, data: reminder });
  } catch (error) { next(error); }
});

// Update reminder (COACH+)
reminderRouter.put("/:id", authenticate, teamContext, requireFeature("reminders"), requireTeamRole("COACH"), validate(reminderSchema), async (req, res, next) => {
  try {
    const existing = await prisma.reminder.findUnique({ where: { id: String(req.params.id) } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Reminder not found");
    const { title, content, deadline } = req.body;
    const reminder = await prisma.reminder.update({
      where: { id: String(req.params.id) },
      data: { title, content: content || null, deadline: deadline ? new Date(deadline) : null },
      include: { createdBy: { select: { id: true, displayName: true } } },
    });
    res.json({ success: true, data: reminder });
  } catch (error) { next(error); }
});

// Toggle done
reminderRouter.patch("/:id/toggle", authenticate, teamContext, requireFeature("reminders"), async (req, res, next) => {
  try {
    const existing = await prisma.reminder.findUnique({ where: { id: String(req.params.id) } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Reminder not found");
    const reminder = await prisma.reminder.update({
      where: { id: String(req.params.id) },
      data: { done: !existing.done },
      include: { createdBy: { select: { id: true, displayName: true } } },
    });
    res.json({ success: true, data: reminder });
  } catch (error) { next(error); }
});

// Delete reminder (COACH+)
reminderRouter.delete("/:id", authenticate, teamContext, requireFeature("reminders"), requireTeamRole("COACH"), async (req, res, next) => {
  try {
    const existing = await prisma.reminder.findUnique({ where: { id: String(req.params.id) } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Reminder not found");
    await prisma.reminder.delete({ where: { id: String(req.params.id) } });
    res.json({ success: true, message: "Reminder deleted" });
  } catch (error) { next(error); }
});
