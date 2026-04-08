import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { teamContext } from "../middleware/team.js";

export const dashboardRouter = Router();

dashboardRouter.use(authenticate, teamContext);

// Stats
dashboardRouter.get("/stats", async (req, res, next) => {
  try {
    const teamId = req.teamId!;
    const now = new Date();

    const [upcomingTrainings, upcomingScrims, recentMatches, teamMembers] = await Promise.all([
      prisma.training.count({ where: { teamId, date: { gte: now } } }),
      prisma.scrim.count({ where: { teamId, date: { gte: now } } }),
      prisma.match.count({ where: { teamId } }),
      prisma.teamMember.count({ where: { teamId } }),
    ]);

    res.json({ success: true, data: { upcomingTrainings, upcomingScrims, recentMatches, teamMembers } });
  } catch (error) { next(error); }
});

// Upcoming events
dashboardRouter.get("/upcoming", async (req, res, next) => {
  try {
    const teamId = req.teamId!;
    const now = new Date();

    const [trainings, scrims, matches] = await Promise.all([
      prisma.training.findMany({
        where: { teamId, date: { gte: now } },
        orderBy: { date: "asc" },
        take: 5,
        select: { id: true, title: true, date: true },
      }),
      prisma.scrim.findMany({
        where: { teamId, date: { gte: now } },
        orderBy: { date: "asc" },
        take: 5,
        select: { id: true, opponent: true, date: true },
      }),
      prisma.match.findMany({
        where: { teamId, date: { gte: now } },
        orderBy: { date: "asc" },
        take: 5,
        select: { id: true, opponent: true, date: true },
      }),
    ]);

    const events = [
      ...trainings.map(t => ({ id: t.id, type: "training" as const, title: t.title, date: t.date.toISOString() })),
      ...scrims.map(s => ({ id: s.id, type: "scrim" as const, title: `Scrim vs ${s.opponent}`, date: s.date.toISOString() })),
      ...matches.map(m => ({ id: m.id, type: "match" as const, title: `Match vs ${m.opponent}`, date: m.date.toISOString() })),
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
