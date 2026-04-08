import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { teamContext, requireTeamRole } from "../middleware/team.js";
import { requireAdmin } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { upload } from "../middleware/upload.js";
import { AppError } from "../middleware/errorHandler.js";
import { logAudit } from "../services/audit.service.js";
import { getAvailableChannels } from "../services/channel-notification.service.js";

export const teamRouter = Router();

const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  tag: z.string().min(1).max(10).optional(),
  game: z.string().optional(),
  logoUrl: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  discordWebhookUrl: z.string().optional().nullable(),
  defaultReminderIntervals: z.array(z.number()).optional(),
  autoEmailEvents: z.boolean().optional(),
  notificationChannel: z.enum(["NONE", "EMAIL", "WHATSAPP"]).optional(),
  enabledFeatures: z.array(z.string()).optional(),
});

const updateConfigSchema = z.object({
  maps: z.array(z.string()).optional(),
  characters: z.array(z.string()).optional(),
  characterLabel: z.string().optional(),
  playerRoles: z.array(z.string()).optional(),
});

const updateMemberSchema = z.object({
  role: z.enum(["TRYOUT", "PLAYER", "ANALYST", "COACH", "CAPTAIN", "ADMIN"]),
  status: z.enum(["ACTIVE", "SUBSTITUTE", "BENCH", "INACTIVE"]).optional(),
  ign: z.string().optional().nullable(),
  realName: z.string().optional().nullable(),
});

// Get the team
teamRouter.get("/", authenticate, teamContext, async (req, res, next) => {
  try {
    const team = await prisma.team.findUnique({
      where: { id: req.teamId! },
      include: { gameConfig: true },
    });
    if (!team) throw new AppError(404, "Team not found");
    res.json({ success: true, data: team });
  } catch (error) { next(error); }
});

// Update team settings (admin only)
teamRouter.put("/", authenticate, teamContext, requireAdmin, validate(updateTeamSchema), async (req, res, next) => {
  try {
    const team = await prisma.team.update({
      where: { id: req.teamId! },
      data: req.body,
    });

    await logAudit(req.user!.id, "UPDATE", "team", team.id, undefined, req.teamId);
    res.json({ success: true, data: team });
  } catch (error) { next(error); }
});

// Get game config
teamRouter.get("/config", authenticate, teamContext, async (req, res, next) => {
  try {
    const config = await prisma.gameConfig.findUnique({ where: { teamId: req.teamId! } });
    if (!config) throw new AppError(404, "Game config not found");
    res.json({ success: true, data: config });
  } catch (error) { next(error); }
});

// Update game config (admin only)
teamRouter.put("/config", authenticate, teamContext, requireAdmin, validate(updateConfigSchema), async (req, res, next) => {
  try {
    const config = await prisma.gameConfig.update({
      where: { teamId: req.teamId! },
      data: req.body,
    });

    await logAudit(req.user!.id, "UPDATE", "game_config", config.id, undefined, req.teamId);
    res.json({ success: true, data: config });
  } catch (error) { next(error); }
});

// Get members
teamRouter.get("/members", authenticate, teamContext, async (req, res, next) => {
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
            email: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    res.json({ success: true, data: members });
  } catch (error) { next(error); }
});

// Update member role (admin only)
teamRouter.put("/members/:uid", authenticate, teamContext, requireAdmin, validate(updateMemberSchema), async (req, res, next) => {
  try {
    const membership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: String(req.params.uid), teamId: req.teamId! } },
    });
    if (!membership) throw new AppError(404, "Member not found");

    const updated = await prisma.teamMember.update({
      where: { id: membership.id },
      data: req.body,
      include: {
        user: {
          select: { id: true, numericId: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    });

    await logAudit(req.user!.id, "UPDATE", "team_member", membership.id, { userId: String(req.params.uid), role: req.body.role }, req.teamId);

    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

// Remove member (admin only)
teamRouter.delete("/members/:uid", authenticate, teamContext, requireAdmin, async (req, res, next) => {
  try {
    const membership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: String(req.params.uid), teamId: req.teamId! } },
    });
    if (!membership) throw new AppError(404, "Member not found");

    await prisma.teamMember.delete({ where: { id: membership.id } });

    await logAudit(req.user!.id, "DELETE", "team_member", membership.id, { userId: String(req.params.uid) }, req.teamId);
    res.json({ success: true, message: "Member removed" });
  } catch (error) { next(error); }
});

// Get available notification channels (based on env configuration)
teamRouter.get("/notification-config", authenticate, teamContext, async (_req, res) => {
  res.json({ success: true, data: getAvailableChannels() });
});

// Upload team logo (admin only)
teamRouter.post("/logo", authenticate, teamContext, requireAdmin, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError(400, "No file uploaded");

    const logoUrl = `/uploads/general/${req.file.filename}`;
    const team = await prisma.team.update({
      where: { id: req.teamId! },
      data: { logoUrl },
    });

    await logAudit(req.user!.id, "UPDATE", "team", team.id, { logoUrl }, req.teamId);
    res.json({ success: true, data: team });
  } catch (error) { next(error); }
});
