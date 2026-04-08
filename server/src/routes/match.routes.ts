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
import { sendWebhookNotification, buildMatchEmbed } from "../services/discord-webhook.service.js";
import * as channelNotify from "../services/channel-notification.service.js";
import { notifyTeam } from "../services/notification.service.js";
import { createEventReminders, updateEventReminders } from "../services/scheduler.service.js";

export const matchRouter = Router();

const matchTypes = ["SCRIM", "TOURNAMENT", "LEAGUE", "FRIENDLY", "OTHER"] as const;

const playerStatSchema = z.object({
  userId: z.string().optional().nullable(),
  externalName: z.string().optional().nullable(),
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
  type: z.enum(matchTypes).default("OTHER"),
  opponent: z.string().min(1).max(200),
  date: z.string().transform(s => new Date(s)),
  competition: z.string().optional().nullable(),
  map: z.string().optional().nullable(),
  side: z.enum(["ATTACK", "DEFENSE"]).optional().nullable(),
  scoreUs: z.number().int().min(0).optional().nullable(),
  scoreThem: z.number().int().min(0).optional().nullable(),
  result: z.enum(["WIN", "LOSS", "DRAW"]).optional().nullable(),
  notes: z.string().optional().nullable(),
  operatorBans: z.array(z.string()).optional().default([]),
  overtimeUs: z.number().int().optional().nullable(),
  overtimeThem: z.number().int().optional().nullable(),
  // Scrim/event fields
  meetTime: z.string().transform(s => new Date(s)).optional().nullable(),
  endDate: z.string().transform(s => new Date(s)).optional().nullable(),
  mapPool: z.array(z.string()).optional().default([]),
  format: z.string().optional().nullable(),
  contactInfo: z.string().optional().nullable(),
  serverRegion: z.string().optional().nullable(),
  recurrence: z.enum(["NONE", "DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"]).optional().default("NONE"),
  reminderIntervals: z.array(z.number()).optional().default([]),
  playerStats: z.array(playerStatSchema).optional().default([]),
});

const updateSchema = createSchema.partial();

const voteSchema = z.object({
  status: z.enum(["AVAILABLE", "UNAVAILABLE", "MAYBE"]),
  comment: z.string().optional().nullable(),
});

const resultSchema = z.object({
  scoreUs: z.number().int().min(0),
  scoreThem: z.number().int().min(0),
  mapResults: z.any().optional().nullable(),
  notes: z.string().optional().nullable(),
  skillRating: z.number().int().min(1).max(5).optional().nullable(),
  communicationRating: z.number().int().min(1).max(5).optional().nullable(),
  punctualityRating: z.number().int().min(1).max(5).optional().nullable(),
});

const matchInclude = {
  createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
  playerStats: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
  votes: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
  mossFiles: true,
  replay: true,
  review: true,
};

// List matches
matchRouter.get("/", authenticate, teamContext, requireFeature("matches"), async (req, res, next) => {
  try {
    const { from, to, opponent, map, result, type } = req.query;
    const where: any = { teamId: req.teamId };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from as string);
      if (to) where.date.lte = new Date(to as string);
    }
    if (opponent) where.opponent = { contains: opponent as string, mode: "insensitive" };
    if (map) where.map = map;
    if (result) where.result = result;
    if (type) where.type = type;

    const matches = await prisma.match.findMany({
      where,
      include: matchInclude,
      orderBy: { date: "desc" },
    });

    res.json({ success: true, data: matches });
  } catch (error) { next(error); }
});

// Get single match
matchRouter.get("/:id", authenticate, teamContext, requireFeature("matches"), async (req, res, next) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: String(req.params.id) },
      include: matchInclude,
    });
    if (!match || match.teamId !== req.teamId) throw new AppError(404, "Match not found");
    res.json({ success: true, data: match });
  } catch (error) { next(error); }
});

// Create match
matchRouter.post("/", authenticate, teamContext, requireFeature("matches"), requireTeamRole("COACH"), validate(createSchema), async (req, res, next) => {
  try {
    const { playerStats, reminderIntervals, ...data } = req.body;

    // Use team defaults for reminder intervals if not provided and type is SCRIM
    let intervals = reminderIntervals || [];
    if (data.type === "SCRIM" && intervals.length === 0) {
      const team = await prisma.team.findUnique({ where: { id: req.teamId! }, select: { defaultReminderIntervals: true } });
      intervals = team?.defaultReminderIntervals || [];
    }

    const match = await prisma.match.create({
      data: {
        ...data,
        reminderIntervals: intervals,
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
            userId: ps.userId || null,
            externalName: ps.externalName || null,
            matchId: match.id,
            teamId: req.teamId!,
            kills: ps.kills, deaths: ps.deaths, assists: ps.assists, headshots: ps.headshots,
            score: ps.score, operator: ps.operator, operators: ps.operators,
            notes: ps.notes, clutches: ps.clutches,
            kd: Math.round(kd * 100) / 100,
            headshotRate: Math.round(headshotRate * 100) / 100,
          },
        });
      }
    }

    // Event reminders for scrim-type matches
    if (intervals.length > 0) {
      await createEventReminders("MATCH", match.id, match.date, intervals, req.teamId!);
    }

    // Notifications for scrim-type matches
    if (data.type === "SCRIM") {
      await notifyTeam({ type: "MATCH_CREATED", title: "Neuer Scrim", message: `Scrim vs ${match.opponent}`, link: `/matches/${match.id}`, teamId: req.teamId!, actorId: req.user!.id });
      channelNotify.notifyNewEvent(req.teamId!, "Scrim", `Scrim vs ${match.opponent}`, match.date.toLocaleString("de-DE"), req.user!.displayName).catch(console.error);
    }

    const full = await prisma.match.findUnique({ where: { id: match.id }, include: matchInclude });

    await logAudit(req.user!.id, "CREATE", "match", match.id, { opponent: match.opponent, type: match.type }, req.teamId);
    safeEmit(`team:${req.teamId}`, "match:created", full);
    sendWebhookNotification(buildMatchEmbed({ opponent: match.opponent, map: match.map, result: match.result, scoreUs: match.scoreUs, scoreThem: match.scoreThem, competition: match.competition, type: match.type })).catch(console.error);

    res.status(201).json({ success: true, data: full });
  } catch (error) { next(error); }
});

// Update match
matchRouter.put("/:id", authenticate, teamContext, requireFeature("matches"), requireTeamRole("COACH"), validate(updateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.match.findUnique({ where: { id: String(req.params.id) } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Match not found");

    const { playerStats, ...data } = req.body;

    const match = await prisma.match.update({ where: { id: String(req.params.id) }, data });

    if (playerStats !== undefined) {
      await prisma.matchPlayerStat.deleteMany({ where: { matchId: match.id } });
      for (const ps of playerStats) {
        const kd = ps.deaths > 0 ? ps.kills / ps.deaths : ps.kills;
        const headshotRate = ps.kills > 0 ? ps.headshots / ps.kills : 0;
        await prisma.matchPlayerStat.create({
          data: {
            userId: ps.userId || null, externalName: ps.externalName || null,
            matchId: match.id, teamId: req.teamId!,
            kills: ps.kills, deaths: ps.deaths, assists: ps.assists, headshots: ps.headshots,
            score: ps.score, operator: ps.operator, operators: ps.operators,
            notes: ps.notes, clutches: ps.clutches,
            kd: Math.round(kd * 100) / 100, headshotRate: Math.round(headshotRate * 100) / 100,
          },
        });
      }
    }

    // Update reminders if date or intervals changed
    if (match.reminderIntervals.length > 0 && (data.date || data.reminderIntervals)) {
      await updateEventReminders("MATCH", match.id, match.date, match.reminderIntervals, req.teamId!);
    }

    // Notifications for scrim-type
    if (match.type === "SCRIM") {
      channelNotify.notifyEventUpdated(req.teamId!, "Scrim", `Scrim vs ${match.opponent}`, match.date.toLocaleString("de-DE"), req.user!.displayName).catch(console.error);
    }

    const full = await prisma.match.findUnique({ where: { id: match.id }, include: matchInclude });

    await logAudit(req.user!.id, "UPDATE", "match", match.id, undefined, req.teamId);
    safeEmit(`team:${req.teamId}`, "match:updated", full);

    res.json({ success: true, data: full });
  } catch (error) { next(error); }
});

// Delete match
matchRouter.delete("/:id", authenticate, teamContext, requireFeature("matches"), requireTeamRole("COACH"), async (req, res, next) => {
  try {
    const existing = await prisma.match.findUnique({ where: { id: String(req.params.id) } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Match not found");

    // Cleanup reminders
    await prisma.eventReminder.deleteMany({ where: { eventType: "MATCH", eventId: existing.id } });

    // Notifications for scrim-type
    if (existing.type === "SCRIM") {
      channelNotify.notifyEventDeleted(req.teamId!, "Scrim", existing.opponent, req.user!.displayName).catch(console.error);
    }

    await prisma.match.delete({ where: { id: String(req.params.id) } });

    await logAudit(req.user!.id, "DELETE", "match", String(req.params.id), { opponent: existing.opponent, type: existing.type }, req.teamId);
    safeEmit(`team:${req.teamId}`, "match:deleted", { id: String(req.params.id) });

    res.json({ success: true, message: "Match deleted" });
  } catch (error) { next(error); }
});

// Vote on match attendance (for SCRIM type)
matchRouter.post("/:id/vote", authenticate, teamContext, requireFeature("matches"), validate(voteSchema), async (req, res, next) => {
  try {
    const match = await prisma.match.findUnique({ where: { id: String(req.params.id) } });
    if (!match || match.teamId !== req.teamId) throw new AppError(404, "Match not found");

    const vote = await prisma.matchVote.upsert({
      where: { userId_matchId: { userId: req.user!.id, matchId: match.id } },
      update: { status: req.body.status, comment: req.body.comment },
      create: { userId: req.user!.id, matchId: match.id, status: req.body.status, comment: req.body.comment },
      include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
    });

    safeEmit(`team:${req.teamId}`, "match:vote", { matchId: match.id, vote });
    res.json({ success: true, data: vote });
  } catch (error) { next(error); }
});

// Retract vote
matchRouter.delete("/:id/vote", authenticate, teamContext, requireFeature("matches"), async (req, res, next) => {
  try {
    await prisma.matchVote.deleteMany({ where: { userId: req.user!.id, matchId: String(req.params.id) } });
    safeEmit(`team:${req.teamId}`, "match:vote:retracted", { matchId: String(req.params.id), userId: req.user!.id });
    res.json({ success: true, message: "Vote retracted" });
  } catch (error) { next(error); }
});

// Log result (for matches created without scores, e.g. scrims)
matchRouter.post("/:id/result", authenticate, teamContext, requireFeature("matches"), requireTeamRole("COACH"), validate(resultSchema), async (req, res, next) => {
  try {
    const existing = await prisma.match.findUnique({ where: { id: String(req.params.id) } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Match not found");

    const { scoreUs, scoreThem, ...rest } = req.body;
    const result = scoreUs > scoreThem ? "WIN" : scoreUs < scoreThem ? "LOSS" : "DRAW";

    const match = await prisma.match.update({
      where: { id: String(req.params.id) },
      data: { scoreUs, scoreThem, result, ...rest },
      include: matchInclude,
    });

    await logAudit(req.user!.id, "UPDATE", "match_result", match.id, undefined, req.teamId);
    safeEmit(`team:${req.teamId}`, "match:result", match);

    res.json({ success: true, data: match });
  } catch (error) { next(error); }
});

// Attendance summary
matchRouter.get("/:id/attendance", authenticate, teamContext, requireFeature("matches"), async (req, res, next) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: String(req.params.id) },
      include: { votes: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } } },
    });
    if (!match || match.teamId !== req.teamId) throw new AppError(404, "Match not found");

    const members = await prisma.teamMember.findMany({
      where: { teamId: req.teamId },
      include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
    });

    const voteMap = new Map(match.votes.map(v => [v.userId, v]));
    const available = match.votes.filter(v => v.status === "AVAILABLE").map(v => v.user);
    const unavailable = match.votes.filter(v => v.status === "UNAVAILABLE").map(v => v.user);
    const maybe = match.votes.filter(v => v.status === "MAYBE").map(v => v.user);
    const noResponse = members.filter(m => !voteMap.has(m.userId)).map(m => m.user);

    res.json({ success: true, data: { available, unavailable, maybe, noResponse } });
  } catch (error) { next(error); }
});

// Stats overview
matchRouter.get("/stats/overview", authenticate, teamContext, requireFeature("matches"), async (req, res, next) => {
  try {
    const { type } = req.query;
    const where: any = { teamId: req.teamId, result: { not: null } };
    if (type) where.type = type;

    const matches = await prisma.match.findMany({
      where,
      select: { result: true, scoreUs: true, scoreThem: true },
    });

    const stats = {
      total: matches.length,
      wins: matches.filter(m => m.result === "WIN").length,
      losses: matches.filter(m => m.result === "LOSS").length,
      draws: matches.filter(m => m.result === "DRAW").length,
      roundsWon: matches.reduce((sum, m) => sum + (m.scoreUs ?? 0), 0),
      roundsLost: matches.reduce((sum, m) => sum + (m.scoreThem ?? 0), 0),
      winRate: matches.length > 0 ? Math.round((matches.filter(m => m.result === "WIN").length / matches.length) * 100) : 0,
    };

    res.json({ success: true, data: stats });
  } catch (error) { next(error); }
});

// Stats by map
matchRouter.get("/stats/maps", authenticate, teamContext, requireFeature("matches"), async (req, res, next) => {
  try {
    const { type } = req.query;
    const where: any = { teamId: req.teamId, map: { not: null }, result: { not: null } };
    if (type) where.type = type;

    const matches = await prisma.match.findMany({
      where,
      select: { map: true, result: true, scoreUs: true, scoreThem: true },
    });

    const mapStats: Record<string, { total: number; wins: number; losses: number; draws: number; roundsWon: number; roundsLost: number }> = {};
    for (const m of matches) {
      const key = m.map!;
      if (!mapStats[key]) mapStats[key] = { total: 0, wins: 0, losses: 0, draws: 0, roundsWon: 0, roundsLost: 0 };
      const s = mapStats[key];
      s.total++;
      if (m.result === "WIN") s.wins++;
      else if (m.result === "LOSS") s.losses++;
      else s.draws++;
      s.roundsWon += m.scoreUs ?? 0;
      s.roundsLost += m.scoreThem ?? 0;
    }

    res.json({ success: true, data: mapStats });
  } catch (error) { next(error); }
});

// Stats by opponent
matchRouter.get("/stats/opponents", authenticate, teamContext, requireFeature("matches"), async (req, res, next) => {
  try {
    const { type } = req.query;
    const where: any = { teamId: req.teamId, result: { not: null } };
    if (type) where.type = type;

    const matches = await prisma.match.findMany({
      where,
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
