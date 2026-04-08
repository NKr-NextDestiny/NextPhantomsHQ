import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { teamContext, requireTeamRole } from "../middleware/team.js";
import { requireFeature } from "../middleware/features.js";
import { validate } from "../middleware/validate.js";
import { AppError } from "../middleware/errorHandler.js";

export const trainingTemplateRouter = Router();

const templateSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    type: z.enum(["RANKED", "CUSTOM", "AIM_TRAINING", "VOD_REVIEW", "STRAT_PRACTICE", "OTHER"]),
    notes: z.string().max(5000).optional(),
  }),
});

// List templates
trainingTemplateRouter.get("/", authenticate, teamContext, requireFeature("training"), async (req, res, next) => {
  try {
    const templates = await prisma.trainingTemplate.findMany({
      where: { teamId: req.teamId! },
      include: { createdBy: { select: { id: true, displayName: true } } },
      orderBy: { title: "asc" },
    });
    res.json({ success: true, data: templates });
  } catch (error) { next(error); }
});

// Create template (COACH+)
trainingTemplateRouter.post("/", authenticate, teamContext, requireFeature("training"), requireTeamRole("COACH"), validate(templateSchema), async (req, res, next) => {
  try {
    const { title, type, notes } = req.body;
    const template = await prisma.trainingTemplate.create({
      data: { title, type, notes: notes || null, teamId: req.teamId!, createdById: req.user!.id },
      include: { createdBy: { select: { id: true, displayName: true } } },
    });
    res.status(201).json({ success: true, data: template });
  } catch (error) { next(error); }
});

// Update template (COACH+)
trainingTemplateRouter.put("/:id", authenticate, teamContext, requireFeature("training"), requireTeamRole("COACH"), validate(templateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.trainingTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Template not found");
    const { title, type, notes } = req.body;
    const template = await prisma.trainingTemplate.update({
      where: { id: req.params.id },
      data: { title, type, notes: notes || null },
      include: { createdBy: { select: { id: true, displayName: true } } },
    });
    res.json({ success: true, data: template });
  } catch (error) { next(error); }
});

// Delete template (COACH+)
trainingTemplateRouter.delete("/:id", authenticate, teamContext, requireFeature("training"), requireTeamRole("COACH"), async (req, res, next) => {
  try {
    const existing = await prisma.trainingTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Template not found");
    await prisma.trainingTemplate.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Template deleted" });
  } catch (error) { next(error); }
});
