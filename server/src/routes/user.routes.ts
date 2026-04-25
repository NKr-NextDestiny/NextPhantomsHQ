import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { teamContext } from "../middleware/team.js";
import { validate } from "../middleware/validate.js";
import { AppError } from "../middleware/errorHandler.js";

export const userRouter = Router();

const updateSchema = z.object({
  language: z.string().min(2).max(5).optional(),
  r6Username: z.string().optional().nullable(),
});

// Get current user profile
userRouter.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        numericId: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        email: true,
        isAdmin: true,
        language: true,
        emailNotifications: true,
        phone: true,
        r6Username: true,
        createdAt: true,
        teamMemberships: {
          include: {
            team: { select: { id: true, name: true, tag: true, game: true, logoUrl: true } },
          },
        },
      },
    });

    if (!user) throw new AppError(404, "User not found");
    res.json({ success: true, data: user });
  } catch (error) { next(error); }
});

// Update current user profile
userRouter.put("/me", authenticate, validate(updateSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: req.body,
      select: {
        id: true,
        numericId: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        email: true,
        isAdmin: true,
        language: true,
        emailNotifications: true,
        phone: true,
        r6Username: true,
      },
    });

    res.json({ success: true, data: user });
  } catch (error) { next(error); }
});

// List all users (team members)
userRouter.get("/", authenticate, teamContext, async (req, res, next) => {
  try {
    const members = await prisma.teamMember.findMany({
      where: { teamId: req.teamId },
      include: {
        user: {
          select: {
            id: true,
            numericId: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isAdmin: true,
            r6Username: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    const users = members.map(m => ({
      ...m.user,
      role: m.role,
      status: m.status,
      ign: m.ign,
      joinedAt: m.joinedAt,
    }));

    res.json({ success: true, data: users });
  } catch (error) { next(error); }
});
