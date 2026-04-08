import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { AppError } from "../middleware/errorHandler.js";

export const attendanceRouter = Router();

// Get attendance token info (public, no auth)
attendanceRouter.get("/:token", async (req, res, next) => {
  try {
    const at = await prisma.attendanceToken.findUnique({
      where: { token: String(req.params.token) },
      include: { user: { select: { displayName: true } } },
    });

    if (!at) throw new AppError(404, "Token not found");
    if (at.expiresAt < new Date()) throw new AppError(410, "Token has expired");

    let eventTitle = "Event";
    let eventDate: Date | null = null;

    if (at.eventType === "TRAINING") {
      const t = await prisma.training.findUnique({ where: { id: at.eventId } });
      if (t) { eventTitle = t.title; eventDate = t.date; }
    } else if (at.eventType === "MATCH") {
      const m = await prisma.match.findUnique({ where: { id: at.eventId } });
      if (m) { eventTitle = m.type === "SCRIM" ? `Scrim vs ${m.opponent}` : `Match vs ${m.opponent}`; eventDate = m.date; }
    }

    res.json({
      success: true,
      data: {
        userName: at.user.displayName,
        eventType: at.eventType,
        eventTitle,
        eventDate,
        alreadyResponded: !!at.respondedAt,
        currentResponse: at.response,
      },
    });
  } catch (error) { next(error); }
});

// Submit attendance via token (public, no auth)
attendanceRouter.post("/:token", async (req, res, next) => {
  try {
    const schema = z.object({
      vote: z.enum(["AVAILABLE", "UNAVAILABLE", "MAYBE"]),
      reason: z.string().optional().nullable(),
    });
    const { vote, reason } = schema.parse(req.body);

    const at = await prisma.attendanceToken.findUnique({ where: { token: String(req.params.token) } });
    if (!at) throw new AppError(404, "Token not found");
    if (at.expiresAt < new Date()) throw new AppError(410, "Token has expired");

    // Update the token
    await prisma.attendanceToken.update({
      where: { id: at.id },
      data: { response: vote, reason: reason || null, respondedAt: new Date() },
    });

    // Also create/update the actual vote
    if (at.eventType === "TRAINING") {
      await prisma.trainingVote.upsert({
        where: { userId_trainingId: { userId: at.userId, trainingId: at.eventId } },
        update: { status: vote, comment: reason || null },
        create: { userId: at.userId, trainingId: at.eventId, status: vote, comment: reason || null },
      });
    } else if (at.eventType === "MATCH") {
      await prisma.matchVote.upsert({
        where: { userId_matchId: { userId: at.userId, matchId: at.eventId } },
        update: { status: vote, comment: reason || null },
        create: { userId: at.userId, matchId: at.eventId, status: vote, comment: reason || null },
      });
    }

    res.json({ success: true, message: "Attendance recorded" });
  } catch (error) { next(error); }
});
