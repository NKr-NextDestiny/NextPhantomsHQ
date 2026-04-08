import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { teamContext } from "../middleware/team.js";
import { validate } from "../middleware/validate.js";
import { AppError } from "../middleware/errorHandler.js";
import { safeEmit } from "../config/socket.js";

export const commentRouter = Router();

const createSchema = z.object({
  content: z.string().min(1).max(5000),
  entityType: z.enum(["TRAINING", "SCRIM", "STRAT", "MATCH", "LINEUP", "REPLAY"]),
  entityId: z.string().min(1),
});

// List comments for an entity
commentRouter.get("/", authenticate, teamContext, async (req, res, next) => {
  try {
    const { entityType, entityId } = req.query;
    if (!entityType || !entityId) throw new AppError(400, "entityType and entityId are required");

    const comments = await prisma.comment.findMany({
      where: {
        entityType: entityType as any,
        entityId: entityId as string,
        teamId: req.teamId,
      },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({ success: true, data: comments });
  } catch (error) { next(error); }
});

// Create comment
commentRouter.post("/", authenticate, teamContext, validate(createSchema), async (req, res, next) => {
  try {
    const comment = await prisma.comment.create({
      data: {
        content: req.body.content,
        entityType: req.body.entityType,
        entityId: req.body.entityId,
        userId: req.user!.id,
        teamId: req.teamId!,
      },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    safeEmit(`entity:${req.body.entityId}`, "comment:created", comment);
    safeEmit(`team:${req.teamId}`, "comment:created", comment);

    res.status(201).json({ success: true, data: comment });
  } catch (error) { next(error); }
});

// Delete comment
commentRouter.delete("/:id", authenticate, teamContext, async (req, res, next) => {
  try {
    const comment = await prisma.comment.findUnique({ where: { id: String(req.params.id) } });
    if (!comment || comment.teamId !== req.teamId) throw new AppError(404, "Comment not found");

    // Only author or admin can delete
    if (comment.userId !== req.user!.id && !req.user!.isAdmin) {
      throw new AppError(403, "Not authorized");
    }

    await prisma.comment.delete({ where: { id: String(req.params.id) } });

    safeEmit(`entity:${comment.entityId}`, "comment:deleted", { id: String(req.params.id), entityId: comment.entityId });

    res.json({ success: true, message: "Comment deleted" });
  } catch (error) { next(error); }
});
