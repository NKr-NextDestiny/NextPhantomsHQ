import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { teamContext } from "../middleware/team.js";
import { requireAdmin } from "../middleware/auth.js";
import { config } from "../config/index.js";

export const dashboardRouter = Router();

dashboardRouter.use(authenticate, teamContext);

// Stats
dashboardRouter.get("/stats", async (req, res, next) => {
  try {
    const teamId = req.teamId!;
    const now = new Date();

    const [upcomingTrainings, upcomingMatches, totalMatches, teamMembers] = await Promise.all([
      prisma.training.count({ where: { teamId, date: { gte: now } } }),
      prisma.match.count({ where: { teamId, date: { gte: now } } }),
      prisma.match.count({ where: { teamId } }),
      prisma.teamMember.count({ where: { teamId } }),
    ]);

    res.json({ success: true, data: { upcomingTrainings, upcomingMatches, totalMatches, teamMembers } });
  } catch (error) { next(error); }
});

// Upcoming events
dashboardRouter.get("/upcoming", async (req, res, next) => {
  try {
    const teamId = req.teamId!;
    const now = new Date();

    const [trainings, matches] = await Promise.all([
      prisma.training.findMany({
        where: { teamId, date: { gte: now } },
        orderBy: { date: "asc" },
        take: 5,
        select: { id: true, title: true, date: true },
      }),
      prisma.match.findMany({
        where: { teamId, date: { gte: now } },
        orderBy: { date: "asc" },
        take: 10,
        select: { id: true, opponent: true, date: true, type: true },
      }),
    ]);

    const events = [
      ...trainings.map(t => ({ id: t.id, type: "training" as const, title: t.title, date: t.date.toISOString() })),
      ...matches.map(m => ({ id: m.id, type: "match" as const, matchType: m.type, title: `${m.type === "SCRIM" ? "Scrim" : "Match"} vs ${m.opponent}`, date: m.date.toISOString() })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 10);

    res.json({ success: true, data: events });
  } catch (error) { next(error); }
});

// Recent activity (audit log)
dashboardRouter.get("/activity", async (req, res, next) => {
  try {
    const teamId = req.teamId!;

    const logs = await prisma.auditLog.findMany({
      where: { teamId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: { select: { displayName: true } } },
    });

    const activity = logs.map(l => ({
      id: l.id,
      type: l.action,
      description: `${l.action} ${l.entity}`,
      createdAt: l.createdAt.toISOString(),
      user: l.user ? { displayName: l.user.displayName } : undefined,
    }));

    res.json({ success: true, data: activity });
  } catch (error) { next(error); }
});

// Admin stats (user activity, storage usage)
dashboardRouter.get("/admin-stats", authenticate, teamContext, requireAdmin, async (req, res, next) => {
  try {
    const teamId = req.teamId!;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers7d,
      totalTrainings,
      totalMatches,
      totalStrats,
      totalReplays,
      totalPolls,
      totalAuditLogs30d,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.auditLog.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { userId: true },
        distinct: ["userId"],
      }).then(r => r.length),
      prisma.training.count({ where: { teamId } }),
      prisma.match.count({ where: { teamId } }),
      prisma.strat.count({ where: { teamId } }),
      prisma.replay.count({ where: { teamId } }),
      prisma.poll.count({ where: { teamId } }),
      prisma.auditLog.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    ]);

    // Storage usage
    let storageBytes = 0;
    const uploadDir = path.resolve(config.uploadDir);
    try {
      const walkDir = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walkDir(full);
          else storageBytes += fs.statSync(full).size;
        }
      };
      walkDir(uploadDir);
    } catch { /* ignore */ }

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers7d,
        totalTrainings,
        totalMatches,
        totalStrats,
        totalReplays,
        totalPolls,
        apiRequests30d: totalAuditLogs30d,
        storageMb: Math.round(storageBytes / 1024 / 1024 * 100) / 100,
      },
    });
  } catch (error) { next(error); }
});
