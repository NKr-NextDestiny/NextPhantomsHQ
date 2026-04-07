import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";
import { logAudit } from "../services/audit.service.js";

export const adminRouter = Router();

// List all users (admin view)
adminRouter.get("/users", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        numericId: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        email: true,
        isAdmin: true,
        isActive: true,
        language: true,
        r6Username: true,
        createdAt: true,
        updatedAt: true,
        teamMemberships: {
          select: { role: true, status: true, teamId: true, joinedAt: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({ success: true, data: users });
  } catch (error) { next(error); }
});

// Toggle admin status
adminRouter.put("/users/:numericId/admin", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const numericId = parseInt(req.params.numericId, 10);
    if (isNaN(numericId)) throw new AppError(400, "Invalid numeric ID");

    const user = await prisma.user.findUnique({ where: { numericId } });
    if (!user) throw new AppError(404, "User not found");

    // Prevent removing own admin
    if (user.id === req.user!.id) throw new AppError(400, "Cannot change own admin status");

    const updated = await prisma.user.update({
      where: { numericId },
      data: { isAdmin: !user.isAdmin },
      select: {
        id: true,
        numericId: true,
        username: true,
        displayName: true,
        isAdmin: true,
      },
    });

    // Also update team membership role
    const memberships = await prisma.teamMember.findMany({ where: { userId: user.id } });
    for (const m of memberships) {
      if (updated.isAdmin) {
        await prisma.teamMember.update({ where: { id: m.id }, data: { role: "ADMIN" } });
      } else if (m.role === "ADMIN") {
        await prisma.teamMember.update({ where: { id: m.id }, data: { role: "PLAYER" } });
      }
    }

    await logAudit(req.user!.id, "UPDATE", "user", user.id, {
      action: updated.isAdmin ? "granted_admin" : "revoked_admin",
      targetNumericId: numericId,
    });

    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

// Deactivate/reactivate user
adminRouter.put("/users/:numericId/active", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const numericId = parseInt(req.params.numericId, 10);
    if (isNaN(numericId)) throw new AppError(400, "Invalid numeric ID");

    const user = await prisma.user.findUnique({ where: { numericId } });
    if (!user) throw new AppError(404, "User not found");
    if (user.id === req.user!.id) throw new AppError(400, "Cannot deactivate yourself");

    const updated = await prisma.user.update({
      where: { numericId },
      data: { isActive: !user.isActive },
      select: { id: true, numericId: true, username: true, displayName: true, isActive: true },
    });

    await logAudit(req.user!.id, "UPDATE", "user", user.id, {
      action: updated.isActive ? "reactivated" : "deactivated",
    });

    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

// Get audit log
adminRouter.get("/audit", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { limit, offset, entity, action, userId } = req.query;

    const where: any = {};
    if (entity) where.entity = entity;
    if (action) where.action = action;
    if (userId) where.userId = userId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit ? parseInt(limit as string, 10) : 50,
        skip: offset ? parseInt(offset as string, 10) : 0,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ success: true, data: { logs, total } });
  } catch (error) { next(error); }
});
