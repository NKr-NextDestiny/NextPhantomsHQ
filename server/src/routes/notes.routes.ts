import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { teamContext } from "../middleware/team.js";
import { requireFeature } from "../middleware/features.js";
import { validate } from "../middleware/validate.js";
import { AppError } from "../middleware/errorHandler.js";
import { parsePagination } from "../middleware/pagination.js";

export const notesRouter = Router();

const noteSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1),
    isPrivate: z.boolean().optional(),
  }),
});

// List notes (own private + all team notes)
notesRouter.get("/", authenticate, teamContext, requireFeature("notes"), async (req, res, next) => {
  try {
    const notes = await prisma.note.findMany({
      where: {
        teamId: req.teamId!,
        OR: [
          { isPrivate: false },
          { createdById: req.user!.id },
        ],
      },
      include: { createdBy: { select: { id: true, displayName: true } } },
      orderBy: { updatedAt: "desc" },
    });
    res.json({ success: true, data: notes });
  } catch (error) { next(error); }
});

// Get single note
notesRouter.get("/:id", authenticate, teamContext, requireFeature("notes"), async (req, res, next) => {
  try {
    const note = await prisma.note.findUnique({
      where: { id: String(req.params.id) },
      include: { createdBy: { select: { id: true, displayName: true } } },
    });
    if (!note || note.teamId !== req.teamId) throw new AppError(404, "Note not found");
    if (note.isPrivate && note.createdById !== req.user!.id && !req.user!.isAdmin) {
      throw new AppError(403, "Not authorized");
    }
    res.json({ success: true, data: note });
  } catch (error) { next(error); }
});

// Create note
notesRouter.post("/", authenticate, teamContext, requireFeature("notes"), validate(noteSchema), async (req, res, next) => {
  try {
    const { title, content, isPrivate } = req.body;
    const note = await prisma.note.create({
      data: { title, content, isPrivate: isPrivate ?? false, teamId: req.teamId!, createdById: req.user!.id },
      include: { createdBy: { select: { id: true, displayName: true } } },
    });
    res.status(201).json({ success: true, data: note });
  } catch (error) { next(error); }
});

// Update note (own only, admin bypass)
notesRouter.put("/:id", authenticate, teamContext, requireFeature("notes"), validate(noteSchema), async (req, res, next) => {
  try {
    const existing = await prisma.note.findUnique({ where: { id: String(req.params.id) } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Note not found");
    if (existing.createdById !== req.user!.id && !req.user!.isAdmin) throw new AppError(403, "Not authorized");

    const { title, content, isPrivate } = req.body;
    const note = await prisma.note.update({
      where: { id: String(req.params.id) },
      data: { title, content, isPrivate: isPrivate ?? existing.isPrivate },
      include: { createdBy: { select: { id: true, displayName: true } } },
    });
    res.json({ success: true, data: note });
  } catch (error) { next(error); }
});

// Delete note (own only, admin bypass)
notesRouter.delete("/:id", authenticate, teamContext, requireFeature("notes"), async (req, res, next) => {
  try {
    const existing = await prisma.note.findUnique({ where: { id: String(req.params.id) } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Note not found");
    if (existing.createdById !== req.user!.id && !req.user!.isAdmin) throw new AppError(403, "Not authorized");
    await prisma.note.delete({ where: { id: String(req.params.id) } });
    res.json({ success: true, message: "Note deleted" });
  } catch (error) { next(error); }
});
