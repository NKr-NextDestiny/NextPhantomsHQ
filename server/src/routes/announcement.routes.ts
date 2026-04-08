import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { teamContext, requireTeamRole } from "../middleware/team.js";
import { requireFeature } from "../middleware/features.js";
import { validate } from "../middleware/validate.js";
import { AppError } from "../middleware/errorHandler.js";
import { parsePagination } from "../middleware/pagination.js";
import { safeEmit } from "../config/socket.js";
import { sendAnnouncementNotification } from "../services/email.service.js";

export const announcementRouter = Router();

const createSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  pinned: z.boolean().optional().default(false),
  expiresAt: z.string().transform(s => new Date(s)).optional().nullable(),
});

const updateSchema = createSchema.partial();

// List announcements
announcementRouter.get("/", authenticate, teamContext, requireFeature("announcements"), async (req, res, next) => {
  try {
    const announcements = await prisma.announcement.findMany({
      where: { teamId: req.teamId },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
        dismissals: { where: { userId: req.user!.id }, select: { id: true } },
      },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    });

    const data = announcements.map(a => ({
      ...a,
      dismissed: a.dismissals.length > 0,
      dismissals: undefined,
    }));

    res.json({ success: true, data });
  } catch (error) { next(error); }
});

// Get unread count
announcementRouter.get("/unread", authenticate, teamContext, requireFeature("announcements"), async (req, res, next) => {
  try {
    const total = await prisma.announcement.count({
      where: {
        teamId: req.teamId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    const dismissed = await prisma.announcementDismiss.count({
      where: {
        userId: req.user!.id,
        announcement: {
          teamId: req.teamId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      },
    });
    res.json({ success: true, data: { unread: total - dismissed } });
  } catch (error) { next(error); }
});

// Get single announcement
announcementRouter.get("/:id", authenticate, teamContext, requireFeature("announcements"), async (req, res, next) => {
  try {
    const announcement = await prisma.announcement.findUnique({
      where: { id: String(req.params.id) },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });
    if (!announcement || announcement.teamId !== req.teamId) throw new AppError(404, "Announcement not found");
    res.json({ success: true, data: announcement });
  } catch (error) { next(error); }
});

// Create announcement
announcementRouter.post("/", authenticate, teamContext, requireFeature("announcements"), requireTeamRole("COACH"), validate(createSchema), async (req, res, next) => {
  try {
    const announcement = await prisma.announcement.create({
      data: {
        ...req.body,
        createdById: req.user!.id,
        teamId: req.teamId!,
      },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    safeEmit(`team:${req.teamId}`, "announcement:created", announcement);

    // Send email notifications
    const members = await prisma.teamMember.findMany({
      where: { teamId: req.teamId! },
      include: { user: { select: { email: true, emailNotifications: true, id: true } } },
    });
    await Promise.all(
      members
        .filter(m => m.user.id !== req.user!.id && m.user.email && m.user.emailNotifications)
        .map(m => sendAnnouncementNotification(m.user.email, announcement.title, req.user!.displayName).catch(console.error))
    );

    res.status(201).json({ success: true, data: announcement });
  } catch (error) { next(error); }
});

// Update announcement
announcementRouter.put("/:id", authenticate, teamContext, requireFeature("announcements"), requireTeamRole("COACH"), validate(updateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.announcement.findUnique({ where: { id: String(req.params.id) } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Announcement not found");

    const announcement = await prisma.announcement.update({
      where: { id: String(req.params.id) },
      data: req.body,
      include: { createdBy: { select: { id: true, displayName: true, avatarUrl: true } } },
    });

    safeEmit(`team:${req.teamId}`, "announcement:updated", announcement);

    res.json({ success: true, data: announcement });
  } catch (error) { next(error); }
});

// Delete announcement
announcementRouter.delete("/:id", authenticate, teamContext, requireFeature("announcements"), requireTeamRole("COACH"), async (req, res, next) => {
  try {
    const existing = await prisma.announcement.findUnique({ where: { id: String(req.params.id) } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Announcement not found");

    await prisma.announcement.delete({ where: { id: String(req.params.id) } });

    safeEmit(`team:${req.teamId}`, "announcement:deleted", { id: String(req.params.id) });

    res.json({ success: true, message: "Announcement deleted" });
  } catch (error) { next(error); }
});

// Dismiss announcement
announcementRouter.post("/:id/dismiss", authenticate, teamContext, requireFeature("announcements"), async (req, res, next) => {
  try {
    await prisma.announcementDismiss.upsert({
      where: { announcementId_userId: { announcementId: String(req.params.id), userId: req.user!.id } },
      update: {},
      create: { announcementId: String(req.params.id), userId: req.user!.id },
    });
    res.json({ success: true, message: "Dismissed" });
  } catch (error) { next(error); }
});

// Pin/unpin announcement
announcementRouter.post("/:id/pin", authenticate, teamContext, requireFeature("announcements"), requireTeamRole("COACH"), async (req, res, next) => {
  try {
    const existing = await prisma.announcement.findUnique({ where: { id: String(req.params.id) } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Announcement not found");

    const announcement = await prisma.announcement.update({
      where: { id: String(req.params.id) },
      data: { pinned: !existing.pinned },
    });

    res.json({ success: true, data: announcement });
  } catch (error) { next(error); }
});
