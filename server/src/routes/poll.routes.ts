import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { teamContext, requireTeamRole } from "../middleware/team.js";
import { requireFeature } from "../middleware/features.js";
import { validate } from "../middleware/validate.js";
import { AppError } from "../middleware/errorHandler.js";
import { getIO } from "../config/socket.js";

export const pollRouter = Router();

const createSchema = z.object({
  question: z.string().min(1).max(500),
  description: z.string().optional().nullable(),
  deadline: z.string().transform(s => new Date(s)).optional().nullable(),
  allowMultiple: z.boolean().optional().default(false),
  options: z.array(z.object({ text: z.string().min(1), order: z.number().int().optional().default(0) })).min(2),
});

const voteSchema = z.object({
  optionId: z.string().min(1),
});

// List polls
pollRouter.get("/", authenticate, teamContext, requireFeature("polls"), async (req, res, next) => {
  try {
    const polls = await prisma.poll.findMany({
      where: { teamId: req.teamId },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
        options: {
          include: {
            votes: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
          },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: polls });
  } catch (error) { next(error); }
});

// Get single poll
pollRouter.get("/:id", authenticate, teamContext, requireFeature("polls"), async (req, res, next) => {
  try {
    const poll = await prisma.poll.findUnique({
      where: { id: String(req.params.id) },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
        options: {
          include: {
            votes: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
          },
          orderBy: { order: "asc" },
        },
      },
    });
    if (!poll || poll.teamId !== req.teamId) throw new AppError(404, "Poll not found");
    res.json({ success: true, data: poll });
  } catch (error) { next(error); }
});

// Create poll
pollRouter.post("/", authenticate, teamContext, requireFeature("polls"), requireTeamRole("PLAYER"), validate(createSchema), async (req, res, next) => {
  try {
    const { options, ...data } = req.body;

    const poll = await prisma.poll.create({
      data: {
        ...data,
        createdById: req.user!.id,
        teamId: req.teamId!,
        options: {
          create: options.map((o: any, i: number) => ({
            text: o.text,
            order: o.order ?? i,
          })),
        },
      },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
        options: {
          include: { votes: true },
          orderBy: { order: "asc" },
        },
      },
    });

    try { getIO().to(`team:${req.teamId}`).emit("poll:created", poll); } catch {}

    res.status(201).json({ success: true, data: poll });
  } catch (error) { next(error); }
});

// Vote on poll
pollRouter.post("/:id/vote", authenticate, teamContext, requireFeature("polls"), validate(voteSchema), async (req, res, next) => {
  try {
    const poll = await prisma.poll.findUnique({
      where: { id: String(req.params.id) },
      include: { options: true },
    });
    if (!poll || poll.teamId !== req.teamId) throw new AppError(404, "Poll not found");

    if (poll.deadline && new Date() > poll.deadline) {
      throw new AppError(400, "Poll has expired");
    }

    const option = poll.options.find(o => o.id === req.body.optionId);
    if (!option) throw new AppError(400, "Invalid option");

    if (!poll.allowMultiple) {
      // Remove previous votes
      const previousVotes = await prisma.pollVote.findMany({
        where: {
          userId: req.user!.id,
          pollOption: { pollId: poll.id },
        },
      });
      if (previousVotes.length > 0) {
        await prisma.pollVote.deleteMany({
          where: { id: { in: previousVotes.map(v => v.id) } },
        });
      }
    }

    const vote = await prisma.pollVote.upsert({
      where: { pollOptionId_userId: { pollOptionId: req.body.optionId, userId: req.user!.id } },
      update: {},
      create: { pollOptionId: req.body.optionId, userId: req.user!.id },
      include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
    });

    try { getIO().to(`team:${req.teamId}`).emit("poll:vote", { pollId: String(req.params.id), vote }); } catch {}

    res.json({ success: true, data: vote });
  } catch (error) { next(error); }
});

// Retract vote
pollRouter.delete("/:id/vote", authenticate, teamContext, requireFeature("polls"), async (req, res, next) => {
  try {
    const { optionId } = req.query;

    if (optionId) {
      await prisma.pollVote.deleteMany({
        where: { pollOptionId: optionId as string, userId: req.user!.id },
      });
    } else {
      // Remove all votes for this poll
      const poll = await prisma.poll.findUnique({
        where: { id: String(req.params.id) },
        include: { options: { select: { id: true } } },
      });
      if (poll) {
        await prisma.pollVote.deleteMany({
          where: {
            userId: req.user!.id,
            pollOptionId: { in: poll.options.map(o => o.id) },
          },
        });
      }
    }

    try { getIO().to(`team:${req.teamId}`).emit("poll:vote:retracted", { pollId: String(req.params.id), userId: req.user!.id }); } catch {}

    res.json({ success: true, message: "Vote retracted" });
  } catch (error) { next(error); }
});

// Delete poll
pollRouter.delete("/:id", authenticate, teamContext, requireFeature("polls"), requireTeamRole("COACH"), async (req, res, next) => {
  try {
    const poll = await prisma.poll.findUnique({ where: { id: String(req.params.id) } });
    if (!poll || poll.teamId !== req.teamId) throw new AppError(404, "Poll not found");

    // Only creator or coach+ can delete
    if (poll.createdById !== req.user!.id && !req.user!.isAdmin) {
      // Check role - already handled by requireTeamRole("COACH")
    }

    await prisma.poll.delete({ where: { id: String(req.params.id) } });

    try { getIO().to(`team:${req.teamId}`).emit("poll:deleted", { id: String(req.params.id) }); } catch {}

    res.json({ success: true, message: "Poll deleted" });
  } catch (error) { next(error); }
});
