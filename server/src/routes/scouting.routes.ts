import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { teamContext, requireTeamRole } from "../middleware/team.js";
import { requireFeature } from "../middleware/features.js";
import { validate } from "../middleware/validate.js";
import { AppError } from "../middleware/errorHandler.js";
import { logAudit } from "../services/audit.service.js";

export const scoutingRouter = Router();

const createOpponentSchema = z.object({
  name: z.string().min(1).max(200),
  teamTag: z.string().optional().nullable(),
  threatLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  playstyle: z.string().optional().nullable(),
  strengths: z.string().optional().nullable(),
  weaknesses: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updateOpponentSchema = createOpponentSchema.partial();

const createNoteSchema = z.object({
  map: z.string().optional().nullable(),
  content: z.string().min(1),
  category: z.string().optional().nullable(),
});

// List opponents
scoutingRouter.get("/opponents", authenticate, teamContext, requireFeature("scouting"), async (req, res, next) => {
  try {
    const { search, threatLevel } = req.query;
    const where: any = { teamId: req.teamId };
    if (search) where.name = { contains: search as string, mode: "insensitive" };
    if (threatLevel) where.threatLevel = threatLevel;

    const opponents = await prisma.opponent.findMany({
      where,
      include: { _count: { select: { scoutingNotes: true } } },
      orderBy: { updatedAt: "desc" },
    });

    res.json({ success: true, data: opponents });
  } catch (error) { next(error); }
});

// Get single opponent with notes
scoutingRouter.get("/opponents/:id", authenticate, teamContext, requireFeature("scouting"), async (req, res, next) => {
  try {
    const opponent = await prisma.opponent.findUnique({
      where: { id: req.params.id },
      include: {
        scoutingNotes: {
          include: { createdBy: { select: { id: true, displayName: true, avatarUrl: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!opponent || opponent.teamId !== req.teamId) throw new AppError(404, "Opponent not found");
    res.json({ success: true, data: opponent });
  } catch (error) { next(error); }
});

// Create opponent
scoutingRouter.post("/opponents", authenticate, teamContext, requireFeature("scouting"), requireTeamRole("ANALYST"), validate(createOpponentSchema), async (req, res, next) => {
  try {
    const opponent = await prisma.opponent.create({
      data: {
        ...req.body,
        teamId: req.teamId!,
      },
    });

    await logAudit(req.user!.id, "CREATE", "opponent", opponent.id, { name: opponent.name }, req.teamId);
    res.status(201).json({ success: true, data: opponent });
  } catch (error) { next(error); }
});

// Update opponent
scoutingRouter.put("/opponents/:id", authenticate, teamContext, requireFeature("scouting"), requireTeamRole("ANALYST"), validate(updateOpponentSchema), async (req, res, next) => {
  try {
    const existing = await prisma.opponent.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Opponent not found");

    const opponent = await prisma.opponent.update({
      where: { id: req.params.id },
      data: req.body,
    });

    await logAudit(req.user!.id, "UPDATE", "opponent", opponent.id, undefined, req.teamId);
    res.json({ success: true, data: opponent });
  } catch (error) { next(error); }
});

// Delete opponent
scoutingRouter.delete("/opponents/:id", authenticate, teamContext, requireFeature("scouting"), requireTeamRole("COACH"), async (req, res, next) => {
  try {
    const existing = await prisma.opponent.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Opponent not found");

    await prisma.opponent.delete({ where: { id: req.params.id } });

    await logAudit(req.user!.id, "DELETE", "opponent", req.params.id, { name: existing.name }, req.teamId);
    res.json({ success: true, message: "Opponent deleted" });
  } catch (error) { next(error); }
});

// Add scouting note
scoutingRouter.post("/opponents/:id/notes", authenticate, teamContext, requireFeature("scouting"), validate(createNoteSchema), async (req, res, next) => {
  try {
    const opponent = await prisma.opponent.findUnique({ where: { id: req.params.id } });
    if (!opponent || opponent.teamId !== req.teamId) throw new AppError(404, "Opponent not found");

    const note = await prisma.scoutingNote.create({
      data: {
        ...req.body,
        opponentId: req.params.id,
        createdById: req.user!.id,
      },
      include: { createdBy: { select: { id: true, displayName: true, avatarUrl: true } } },
    });

    res.status(201).json({ success: true, data: note });
  } catch (error) { next(error); }
});

// Update scouting note
scoutingRouter.put("/notes/:id", authenticate, teamContext, requireFeature("scouting"), async (req, res, next) => {
  try {
    const note = await prisma.scoutingNote.findUnique({ where: { id: req.params.id } });
    if (!note) throw new AppError(404, "Note not found");

    // Only author or admin can update
    if (note.createdById !== req.user!.id && !req.user!.isAdmin) {
      throw new AppError(403, "Not authorized");
    }

    const schema = z.object({ content: z.string().min(1).optional(), map: z.string().optional().nullable(), category: z.string().optional().nullable() });
    const data = schema.parse(req.body);

    const updated = await prisma.scoutingNote.update({
      where: { id: req.params.id },
      data,
      include: { createdBy: { select: { id: true, displayName: true, avatarUrl: true } } },
    });

    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

// Delete scouting note
scoutingRouter.delete("/notes/:id", authenticate, teamContext, requireFeature("scouting"), async (req, res, next) => {
  try {
    const note = await prisma.scoutingNote.findUnique({ where: { id: req.params.id } });
    if (!note) throw new AppError(404, "Note not found");

    if (note.createdById !== req.user!.id && !req.user!.isAdmin) {
      throw new AppError(403, "Not authorized");
    }

    await prisma.scoutingNote.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Note deleted" });
  } catch (error) { next(error); }
});
