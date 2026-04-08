import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { teamContext } from "../middleware/team.js";

export const searchRouter = Router();

// Global search across trainings, strats, matches, users, wiki
searchRouter.get("/", authenticate, teamContext, async (req, res, next) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (q.length < 2) {
      res.json({ success: true, data: { trainings: [], strats: [], matches: [], users: [], wiki: [] } });
      return;
    }

    const teamId = req.teamId!;
    const contains = { contains: q, mode: "insensitive" as const };

    const [trainings, strats, matches, users, wiki] = await Promise.all([
      prisma.training.findMany({
        where: { teamId, OR: [{ title: contains }, { notes: contains }] },
        select: { id: true, title: true, date: true, type: true },
        take: 10,
        orderBy: { date: "desc" },
      }),
      prisma.strat.findMany({
        where: { teamId, OR: [{ title: contains }, { description: contains }, { map: contains }] },
        select: { id: true, title: true, map: true, side: true },
        take: 10,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.match.findMany({
        where: { teamId, OR: [{ opponent: contains }, { map: contains }, { competition: contains }] },
        select: { id: true, opponent: true, map: true, result: true, date: true, type: true },
        take: 10,
        orderBy: { date: "desc" },
      }),
      prisma.user.findMany({
        where: {
          isActive: true,
          teamMemberships: { some: { teamId } },
          OR: [{ displayName: contains }, { username: contains }, { r6Username: contains }],
        },
        select: { id: true, displayName: true, username: true, avatarUrl: true },
        take: 10,
      }),
      prisma.wikiPage.findMany({
        where: { teamId, OR: [{ title: contains }, { content: contains }] },
        select: { id: true, title: true, slug: true },
        take: 10,
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    res.json({ success: true, data: { trainings, strats, matches, users, wiki } });
  } catch (error) { next(error); }
});
