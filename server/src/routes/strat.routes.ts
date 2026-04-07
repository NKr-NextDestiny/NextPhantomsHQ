import { Router } from "express";
import { z } from "zod";
import path from "node:path";
import fs from "node:fs";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { teamContext, requireTeamRole } from "../middleware/team.js";
import { requireFeature } from "../middleware/features.js";
import { validate } from "../middleware/validate.js";
import { upload } from "../middleware/upload.js";
import { AppError } from "../middleware/errorHandler.js";
import { logAudit } from "../services/audit.service.js";
import { getIO } from "../config/socket.js";
import { config } from "../config/index.js";

export const stratRouter = Router();

const createSchema = z.object({
  title: z.string().min(1).max(200),
  map: z.string().min(1),
  site: z.string().optional().nullable(),
  side: z.enum(["ATTACK", "DEFENSE"]),
  type: z.enum(["DEFAULT", "ANTI_STRAT", "RETAKE", "POST_PLANT", "RUSH", "SLOW_EXECUTE", "OTHER"]).optional(),
  description: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
});

const updateSchema = createSchema.partial().extend({
  changes: z.string().optional().nullable(),
});

// List strats
stratRouter.get("/", authenticate, teamContext, requireFeature("strats"), async (req, res, next) => {
  try {
    const { map, side, type, favorite, search } = req.query;
    const where: any = { teamId: req.teamId };
    if (map) where.map = map;
    if (side) where.side = side;
    if (type) where.type = type;
    if (favorite === "true") where.isFavorite = true;
    if (search) where.title = { contains: search as string, mode: "insensitive" };

    const strats = await prisma.strat.findMany({
      where,
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
        playbooks: { include: { playbook: { select: { id: true, name: true } } } },
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json({ success: true, data: strats });
  } catch (error) { next(error); }
});

// Get single strat
stratRouter.get("/:id", authenticate, teamContext, requireFeature("strats"), async (req, res, next) => {
  try {
    const strat = await prisma.strat.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
        versions: { orderBy: { version: "desc" } },
        playbooks: { include: { playbook: { select: { id: true, name: true } } } },
      },
    });
    if (!strat || strat.teamId !== req.teamId) throw new AppError(404, "Strat not found");
    res.json({ success: true, data: strat });
  } catch (error) { next(error); }
});

// Create strat (with optional file upload)
stratRouter.post("/", authenticate, teamContext, requireFeature("strats"), requireTeamRole("ANALYST"), upload.single("file"), async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);

    let fileUrl: string | null = null;
    let fileName: string | null = null;
    if (req.file) {
      fileUrl = `/uploads/general/${req.file.filename}`;
      fileName = req.file.originalname;
    }

    const strat = await prisma.strat.create({
      data: {
        title: data.title,
        map: data.map,
        site: data.site || null,
        side: data.side,
        type: data.type || "DEFAULT",
        description: data.description || null,
        tags: data.tags,
        fileUrl,
        fileName,
        version: 1,
        createdById: req.user!.id,
        teamId: req.teamId!,
      },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    // Create initial version
    await prisma.stratVersion.create({
      data: {
        stratId: strat.id,
        version: 1,
        fileUrl,
        fileName,
        description: data.description || null,
        changes: "Erstversion",
      },
    });

    await logAudit(req.user!.id, "CREATE", "strat", strat.id, { title: strat.title }, req.teamId);
    try { getIO().to(`team:${req.teamId}`).emit("strat:created", strat); } catch {}

    res.status(201).json({ success: true, data: strat });
  } catch (error) { next(error); }
});

// Update strat (with optional file, creates new version)
stratRouter.put("/:id", authenticate, teamContext, requireFeature("strats"), requireTeamRole("ANALYST"), upload.single("file"), async (req, res, next) => {
  try {
    const existing = await prisma.strat.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Strat not found");

    const data = updateSchema.parse(req.body);
    const newVersion = existing.version + 1;

    let fileUrl = existing.fileUrl;
    let fileName = existing.fileName;
    if (req.file) {
      fileUrl = `/uploads/general/${req.file.filename}`;
      fileName = req.file.originalname;
    }

    const strat = await prisma.strat.update({
      where: { id: req.params.id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.map !== undefined && { map: data.map }),
        ...(data.site !== undefined && { site: data.site }),
        ...(data.side !== undefined && { side: data.side }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.tags !== undefined && { tags: data.tags }),
        fileUrl,
        fileName,
        version: newVersion,
      },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
        versions: { orderBy: { version: "desc" } },
      },
    });

    await prisma.stratVersion.create({
      data: {
        stratId: strat.id,
        version: newVersion,
        fileUrl,
        fileName,
        description: data.description || strat.description,
        changes: data.changes || null,
      },
    });

    await logAudit(req.user!.id, "UPDATE", "strat", strat.id, { version: newVersion }, req.teamId);
    try { getIO().to(`team:${req.teamId}`).emit("strat:updated", strat); } catch {}

    res.json({ success: true, data: strat });
  } catch (error) { next(error); }
});

// Delete strat
stratRouter.delete("/:id", authenticate, teamContext, requireFeature("strats"), requireTeamRole("ANALYST"), async (req, res, next) => {
  try {
    const existing = await prisma.strat.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Strat not found");

    await prisma.strat.delete({ where: { id: req.params.id } });

    await logAudit(req.user!.id, "DELETE", "strat", req.params.id, { title: existing.title }, req.teamId);
    try { getIO().to(`team:${req.teamId}`).emit("strat:deleted", { id: req.params.id }); } catch {}

    res.json({ success: true, message: "Strat deleted" });
  } catch (error) { next(error); }
});

// Toggle favorite
stratRouter.post("/:id/favorite", authenticate, teamContext, requireFeature("strats"), async (req, res, next) => {
  try {
    const strat = await prisma.strat.findUnique({ where: { id: req.params.id } });
    if (!strat || strat.teamId !== req.teamId) throw new AppError(404, "Strat not found");

    const updated = await prisma.strat.update({
      where: { id: req.params.id },
      data: { isFavorite: !strat.isFavorite },
    });

    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

// ----- PLAYBOOKS -----

// List playbooks
stratRouter.get("/playbooks/list", authenticate, teamContext, requireFeature("strats"), async (req, res, next) => {
  try {
    const playbooks = await prisma.playbook.findMany({
      where: { teamId: req.teamId },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
        strats: {
          include: { strat: true },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    res.json({ success: true, data: playbooks });
  } catch (error) { next(error); }
});

// Create playbook
stratRouter.post("/playbooks", authenticate, teamContext, requireFeature("strats"), requireTeamRole("ANALYST"), async (req, res, next) => {
  try {
    const schema = z.object({ name: z.string().min(1).max(200), description: z.string().optional().nullable() });
    const data = schema.parse(req.body);

    const playbook = await prisma.playbook.create({
      data: {
        name: data.name,
        description: data.description || null,
        createdById: req.user!.id,
        teamId: req.teamId!,
      },
      include: { createdBy: { select: { id: true, displayName: true, avatarUrl: true } } },
    });

    res.status(201).json({ success: true, data: playbook });
  } catch (error) { next(error); }
});

// Update playbook
stratRouter.put("/playbooks/:id", authenticate, teamContext, requireFeature("strats"), requireTeamRole("ANALYST"), async (req, res, next) => {
  try {
    const schema = z.object({ name: z.string().min(1).max(200).optional(), description: z.string().optional().nullable() });
    const data = schema.parse(req.body);

    const playbook = await prisma.playbook.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ success: true, data: playbook });
  } catch (error) { next(error); }
});

// Delete playbook
stratRouter.delete("/playbooks/:id", authenticate, teamContext, requireFeature("strats"), requireTeamRole("ANALYST"), async (req, res, next) => {
  try {
    await prisma.playbook.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Playbook deleted" });
  } catch (error) { next(error); }
});

// Add strat to playbook
stratRouter.post("/playbooks/:id/strats", authenticate, teamContext, requireFeature("strats"), requireTeamRole("ANALYST"), async (req, res, next) => {
  try {
    const schema = z.object({ stratId: z.string(), order: z.number().int().optional().default(0) });
    const data = schema.parse(req.body);

    const entry = await prisma.playbookStrat.create({
      data: { playbookId: req.params.id, stratId: data.stratId, order: data.order },
    });
    res.status(201).json({ success: true, data: entry });
  } catch (error) { next(error); }
});

// Remove strat from playbook
stratRouter.delete("/playbooks/:playbookId/strats/:stratId", authenticate, teamContext, requireFeature("strats"), requireTeamRole("ANALYST"), async (req, res, next) => {
  try {
    await prisma.playbookStrat.delete({
      where: { playbookId_stratId: { playbookId: req.params.playbookId, stratId: req.params.stratId } },
    });
    res.json({ success: true, message: "Strat removed from playbook" });
  } catch (error) { next(error); }
});
