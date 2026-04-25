import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { teamContext } from "../middleware/team.js";
import { requireFeature } from "../middleware/features.js";
import { validate } from "../middleware/validate.js";
import { AppError } from "../middleware/errorHandler.js";

export const matchReviewRouter = Router();

const reviewSchema = z.object({
  positives: z.string().max(5000).optional(),
  negatives: z.string().max(5000).optional(),
  improvements: z.string().max(5000).optional(),
  notes: z.string().max(5000).optional(),
});

// Get review for a match
matchReviewRouter.get("/:matchId/review", authenticate, teamContext, requireFeature("matches"), async (req, res, next) => {
  try {
    const match = await prisma.match.findUnique({ where: { id: String(req.params.matchId) } });
    if (!match || match.teamId !== req.teamId) throw new AppError(404, "Match not found");

    const review = await prisma.matchReview.findUnique({ where: { matchId: String(req.params.matchId) } });
    res.json({ success: true, data: review });
  } catch (error) { next(error); }
});

// Create or update review (upsert)
matchReviewRouter.put("/:matchId/review", authenticate, teamContext, requireFeature("matches"), validate(reviewSchema), async (req, res, next) => {
  try {
    const match = await prisma.match.findUnique({ where: { id: String(req.params.matchId) } });
    if (!match || match.teamId !== req.teamId) throw new AppError(404, "Match not found");

    const { positives, negatives, improvements, notes } = req.body;
    const review = await prisma.matchReview.upsert({
      where: { matchId: String(req.params.matchId) },
      create: {
        matchId: String(req.params.matchId),
        teamId: req.teamId!,
        createdById: req.user!.id,
        positives: positives || null,
        negatives: negatives || null,
        improvements: improvements || null,
        notes: notes || null,
      },
      update: {
        positives: positives || null,
        negatives: negatives || null,
        improvements: improvements || null,
        notes: notes || null,
      },
    });
    res.json({ success: true, data: review });
  } catch (error) { next(error); }
});

// Delete review
matchReviewRouter.delete("/:matchId/review", authenticate, teamContext, requireFeature("matches"), async (req, res, next) => {
  try {
    const match = await prisma.match.findUnique({ where: { id: String(req.params.matchId) } });
    if (!match || match.teamId !== req.teamId) throw new AppError(404, "Match not found");

    const review = await prisma.matchReview.findUnique({ where: { matchId: String(req.params.matchId) } });
    if (!review) throw new AppError(404, "Review not found");

    await prisma.matchReview.delete({ where: { id: review.id } });
    res.json({ success: true, message: "Review deleted" });
  } catch (error) { next(error); }
});
