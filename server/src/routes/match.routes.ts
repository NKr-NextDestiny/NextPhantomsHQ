import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { teamContext, requireTeamRole } from "../middleware/team.js";
import { requireFeature } from "../middleware/features.js";
import { validate } from "../middleware/validate.js";
import { AppError } from "../middleware/errorHandler.js";
import { logAudit } from "../services/audit.service.js";
import { getIO } from "../config/socket.js";
import { sendWebhookNotification, buildMatchEmbed } from "../services/discord-webhook.service.js";

export const matchRouter = Router();

const playerStatSchema = z.object({
  userId: z.string(),
  kills: z.number().int().min(0).default(0),
  deaths: z.number().int().min(0).default(0),
  assists: z.number().int().min(0).default(0),
  headshots: z.number().int().min(0).default(0),
  score: z.number().int().optional().nullable(),
  operator: z.string().optional().nullable(),
  operators: z.array(z.string()).optional().default([]),
  notes: z.string().optional().nullable(),
  clutches: z.any().optional().nullable(),
});

const createSchema = z.object({
  opponent: z.string().min(1).max(200),
  date: z.string().transform(s => new Date(s)),
  competition: z.string().optional().nullable(),
  map: z.string().min(1),
  side: z.enum(["ATTACK", "DEFENSE"]).optional().nullable(),
  scoreUs: z.number().int().min(0),
  scoreThem: z.number().int().min(0),
  result: z.enum(["WIN", "LOSS", "DRAW"]),
  notes: z.string().optional().nullable(),
  operatorBans: z.array(z.string()).optional().default([]),
  overtimeUs: z.number().int().optional().nullable(),
  overtimeThem: z.number().int().optional().nullable(),
  scrimId: z.string().optional().nullable(),
  playerStats: z.array(playerStatSchema).optional().default([]),
});

const updateSchema = createSchema.partial();

// List matches
matchRouter.get("/", authenticate, teamContext, requireFeature("matches"), async (req, res, next) => {
  try {
    const { from, to, opponent, map, result } = req.query;
    const where: any = { teamId: req.teamId };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from as string);
      if (to) where.date.lte = new Date(to as string);
    }
    if (opponent) where.opponent = { contains: opponent as string, mode: "insensitive" };
    if (map) where.map = map;
    if (result) where.result = result;

    const matches = await prisma.match.findMany({
      where,
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
        playerStats: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
      },
      orderBy: { date: "desc" },
    });

    res.json({ success: true, data: matches });
  } catch (error) { next(error); }
});

// Get single match
matchRouter.get("/:id", authenticate, teamContext, requireFeature("matches"), async (req, res, next) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
        playerStats: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
        replay: true,
        mossFiles: true,
      },
    });
    if (!match || match.teamId !== req.teamId) throw new AppError(404, "Match not found");
    res.json({ success: true, data: match });
  } catch (error) { next(error); }
});

// Create match
matchRouter.post("/", authenticate, teamContext, requireFeature("matches"), requireTeamRole("COACH"), validate(createSchema), async (req, res, next) => {
  try {
    const { playerStats, ...data } = req.body;

    const match = await prisma.match.create({
      data: {
        ...data,
        createdById: req.user!.id,
        teamId: req.teamId!,
      },
    });

    if (playerStats && playerStats.length > 0) {
      for (const ps of playerStats) {
        const kd = ps.deaths > 0 ? ps.kills / ps.deaths : ps.kills;
        const headshotRate = ps.kills > 0 ? ps.headshots / ps.kills : 0;
        await prisma.matchPlayerStat.create({
          data: {
            userId: ps.userId,
            matchId: match.id,
            teamId: req.teamId!,
            kills: ps.kills,
            deaths: ps.deaths,
            assists: ps.assists,
            headshots: ps.headshots,
            score: ps.score,
            operator: ps.operator,
            operators: ps.operators,
            notes: ps.notes,
            clutches: ps.clutches,
            kd: Math.round(kd * 100) / 100,
            headshotRate: Math.round(headshotRate * 100) / 100,
          },
        });
      }
    }

    const full = await prisma.match.findUnique({
      where: { id: match.id },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
        playerStats: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
      },
    });

    await logAudit(req.user!.id, "CREATE", "match", match.id, { opponent: match.opponent, map: match.map }, req.teamId);
    try { getIO().to(`team:${req.teamId}`).emit("match:created", full); } catch {}
    sendWebhookNotification(buildMatchEmbed({ opponent: match.opponent, map: match.map, result: match.result, scoreUs: match.scoreUs, scoreThem: match.scoreThem, competition: match.competition || undefined })).catch(console.error);

    res.status(201).json({ success: true, data: full });
  } catch (error) { next(error); }
});

// Update match
matchRouter.put("/:id", authenticate, teamContext, requireFeature("matches"), requireTeamRole("COACH"), validate(updateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.match.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Match not found");

    const { playerStats, ...data } = req.body;

    const match = await prisma.match.update({
      where: { id: req.params.id },
      data,
    });

    if (playerStats !== undefined) {
      await prisma.matchPlayerStat.deleteMany({ where: { matchId: match.id } });
      for (const ps of playerStats) {
        const kd = ps.deaths > 0 ? ps.kills / ps.deaths : ps.kills;
        const headshotRate = ps.kills > 0 ? ps.headshots / ps.kills : 0;
        await prisma.matchPlayerStat.create({
          data: {
            userId: ps.userId,
            matchId: match.id,
            teamId: req.teamId!,
            kills: ps.kills,
            deaths: ps.deaths,
            assists: ps.assists,
            headshots: ps.headshots,
            score: ps.score,
            operator: ps.operator,
            operators: ps.operators,
            notes: ps.notes,
            clutches: ps.clutches,
            kd: Math.round(kd * 100) / 100,
            headshotRate: Math.round(headshotRate * 100) / 100,
          },
        });
      }
    }

    const full = await prisma.match.findUnique({
      where: { id: match.id },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
        playerStats: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
      },
    });

    await logAudit(req.user!.id, "UPDATE", "match", match.id, undefined, req.teamId);
    try { getIO().to(`team:${req.teamId}`).emit("match:updated", full); } catch {}

    res.json({ success: true, data: full });
  } catch (error) { next(error); }
});

// Delete match
matchRouter.delete("/:id", authenticate, teamContext, requireFeature("matches"), requireTeamRole("COACH"), async (req, res, next) => {
  try {
    const existing = await prisma.match.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Match not found");

    await prisma.match.delete({ where: { id: req.params.id } });

    await logAudit(req.user!.id, "DELETE", "match", req.params.id, { opponent: existing.opponent }, req.teamId);
    try { getIO().to(`team:${req.teamId}`).emit("match:deleted", { id: req.params.id }); } catch {}

    res.json({ success: true, message: "Match deleted" });
  } catch (error) { next(error); }
});

// Stats overview
matchRouter.get("/stats/overview", authenticate, teamContext, requireFeature("matches"), async (req, res, next) => {
  try {
    const matches = await prisma.match.findMany({
      where: { teamId: req.teamId },
      select: { result: true, scoreUs: true, scoreThem: true },
    });

    const stats = {
      total: matches.length,
      wins: matches.filter(m => m.result === "WIN").length,
      losses: matches.filter(m => m.result === "LOSS").length,
      draws: matches.filter(m => m.result === "DRAW").length,
      roundsWon: matches.reduce((sum, m) => sum + m.scoreUs, 0),
      roundsLost: matches.reduce((sum, m) => sum + m.scoreThem, 0),
      winRate: matches.length > 0 ? Math.round((matches.filter(m => m.result === "WIN").length / matches.length) * 100) : 0,
    };

    res.json({ success: true, data: stats });
  } catch (error) { next(error); }
});

// Stats by map
matchRouter.get("/stats/maps", authenticate, teamContext, requireFeature("matches"), async (req, res, next) => {
  try {
    const matches = await prisma.match.findMany({
      where: { teamId: req.teamId },
      select: { map: true, result: true, scoreUs: true, scoreThem: true },
    });

    const mapStats: Record<string, { total: number; wins: number; losses: number; draws: number; roundsWon: number; roundsLost: number }> = {};
    for (const m of matches) {
      if (!mapStats[m.map]) mapStats[m.map] = { total: 0, wins: 0, losses: 0, draws: 0, roundsWon: 0, roundsLost: 0 };
      const s = mapStats[m.map];
      s.total++;
      if (m.result === "WIN") s.wins++;
      else if (m.result === "LOSS") s.losses++;
      else s.draws++;
      s.roundsWon += m.scoreUs;
      s.roundsLost += m.scoreThem;
    }

    res.json({ success: true, data: mapStats });
  } catch (error) { next(error); }
});

// Stats by opponent
matchRouter.get("/stats/opponents", authenticate, teamContext, requireFeature("matches"), async (req, res, next) => {
  try {
    const matches = await prisma.match.findMany({
      where: { teamId: req.teamId },
      select: { opponent: true, result: true, scoreUs: true, scoreThem: true },
    });

    const oppStats: Record<string, { total: number; wins: number; losses: number; draws: number }> = {};
    for (const m of matches) {
      if (!oppStats[m.opponent]) oppStats[m.opponent] = { total: 0, wins: 0, losses: 0, draws: 0 };
      const s = oppStats[m.opponent];
      s.total++;
      if (m.result === "WIN") s.wins++;
      else if (m.result === "LOSS") s.losses++;
      else s.draws++;
    }

    res.json({ success: true, data: oppStats });
  } catch (error) { next(error); }
});
