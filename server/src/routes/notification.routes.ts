import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";

export const notificationRouter = Router();

// List notifications for current user
notificationRouter.get("/", authenticate, async (req, res, next) => {
  try {
    const { unreadOnly, limit } = req.query;
    const where: any = { userId: req.user!.id };
    if (unreadOnly === "true") where.read = false;

    const notifications = await prisma.notification.findMany({
      where,
      include: {
        actor: { select: { id: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit ? parseInt(limit as string, 10) : 50,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: req.user!.id, read: false },
    });

    res.json({ success: true, data: { notifications, unreadCount } });
  } catch (error) { next(error); }
});

// Mark single notification as read
notificationRouter.put("/:id/read", authenticate, async (req, res, next) => {
  try {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notification || notification.userId !== req.user!.id) throw new AppError(404, "Notification not found");

    await prisma.notification.update({
      where: { id: req.params.id },
      data: { read: true },
    });

    res.json({ success: true, message: "Marked as read" });
  } catch (error) { next(error); }
});

// Mark all notifications as read
notificationRouter.put("/read-all", authenticate, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, read: false },
      data: { read: true },
    });

    res.json({ success: true, message: "All marked as read" });
  } catch (error) { next(error); }
});

// Delete notification
notificationRouter.delete("/:id", authenticate, async (req, res, next) => {
  try {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notification || notification.userId !== req.user!.id) throw new AppError(404, "Notification not found");

    await prisma.notification.delete({ where: { id: req.params.id } });

    res.json({ success: true, message: "Notification deleted" });
  } catch (error) { next(error); }
});
