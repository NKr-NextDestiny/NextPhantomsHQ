import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { teamContext, requireTeamRole } from "../middleware/team.js";
import { requireFeature } from "../middleware/features.js";
import { validate } from "../middleware/validate.js";
import { AppError } from "../middleware/errorHandler.js";
import { logAudit } from "../services/audit.service.js";
import { safeEmit } from "../config/socket.js";

export const lineupRouter = Router();

const playerSchema = z.object({
  userId: z.string(),
  role: z.string().min(1),
  operators: z.array(z.string()).optional().default([]),
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  map: z.string().min(1),
  side: z.enum(["ATTACK", "DEFENSE"]),
  notes: z.string().optional().nullable(),
  players: z.array(playerSchema).optional().default([]),
});

const updateSchema = createSchema.partial();

// List lineups
lineupRouter.get("/", authenticate, teamContext, requireFeature("lineup"), async (req, res, next) => {
  try {
    const { map, side } = req.query;
    const where: any = { teamId: req.teamId };
    if (map) where.map = map;
    if (side) where.side = side;

    const lineups = await prisma.lineup.findMany({
      where,
      include: {
        players: {
          include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json({ success: true, data: lineups });
  } catch (error) { next(error); }
});

// Get single lineup
lineupRouter.get("/:id", authenticate, teamContext, requireFeature("lineup"), async (req, res, next) => {
  try {
    const lineup = await prisma.lineup.findUnique({
      where: { id: String(req.params.id) },
      include: {
        players: {
          include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
        },
      },
    });
    if (!lineup || lineup.teamId !== req.teamId) throw new AppError(404, "Lineup not found");
    res.json({ success: true, data: lineup });
  } catch (error) { next(error); }
});

// Create lineup
lineupRouter.post("/", authenticate, teamContext, requireFeature("lineup"), requireTeamRole("COACH"), validate(createSchema), async (req, res, next) => {
  try {
    const { players, ...data } = req.body;

    const lineup = await prisma.lineup.create({
      data: {
        ...data,
        teamId: req.teamId!,
        players: {
          create: players.map((p: any) => ({
            userId: p.userId,
            role: p.role,
            operators: p.operators,
          })),
        },
      },
      include: {
        players: {
          include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
        },
      },
    });

    await logAudit(req.user!.id, "CREATE", "lineup", lineup.id, { name: lineup.name }, req.teamId);
    safeEmit(`team:${req.teamId}`, "lineup:created", lineup);

    res.status(201).json({ success: true, data: lineup });
  } catch (error) { next(error); }
});

// Update lineup
lineupRouter.put("/:id", authenticate, teamContext, requireFeature("lineup"), requireTeamRole("COACH"), validate(updateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.lineup.findUnique({ where: { id: String(req.params.id) } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Lineup not found");

    const { players, ...data } = req.body;

    if (players !== undefined) {
      await prisma.lineupPlayer.deleteMany({ where: { lineupId: String(req.params.id) } });
      if (players.length > 0) {
        await prisma.lineupPlayer.createMany({
          data: players.map((p: any) => ({
            lineupId: String(req.params.id),
            userId: p.userId,
            role: p.role,
            operators: p.operators || [],
          })),
        });
      }
    }

    const lineup = await prisma.lineup.update({
      where: { id: String(req.params.id) },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.map !== undefined && { map: data.map }),
        ...(data.side !== undefined && { side: data.side }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
      include: {
        players: {
          include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
        },
      },
    });

    await logAudit(req.user!.id, "UPDATE", "lineup", lineup.id, undefined, req.teamId);
    safeEmit(`team:${req.teamId}`, "lineup:updated", lineup);

    res.json({ success: true, data: lineup });
  } catch (error) { next(error); }
});

// Delete lineup
lineupRouter.delete("/:id", authenticate, teamContext, requireFeature("lineup"), requireTeamRole("COACH"), async (req, res, next) => {
  try {
    const existing = await prisma.lineup.findUnique({ where: { id: String(req.params.id) } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Lineup not found");

    await prisma.lineup.delete({ where: { id: String(req.params.id) } });

    await logAudit(req.user!.id, "DELETE", "lineup", String(req.params.id), { name: existing.name }, req.teamId);
    safeEmit(`team:${req.teamId}`, "lineup:deleted", { id: String(req.params.id) });

    res.json({ success: true, message: "Lineup deleted" });
  } catch (error) { next(error); }
});
