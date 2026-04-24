import { Router } from "express";
import { z } from "zod";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { teamContext } from "../middleware/team.js";
import { validate } from "../middleware/validate.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { logAudit } from "../services/audit.service.js";
import { BOT_COMMANDS, formatCommandHelpMessage, postCommandHelpToGroup } from "../services/bot-commands.service.js";
import { buildGroupDescription, scheduleGroupDescriptionUpdate, updateGroupDescription } from "../services/group-description.service.js";
import * as evolutionService from "../services/evolution.service.js";
import { createAnnouncementImage, createMatchResultImage, createPollResultImage } from "../services/notification-image.service.js";

export const teamWhatsAppRouter = Router();

interface GroupDescriptionBlockRecord {
  id: string;
  content: string;
  position: "ABOVE" | "BELOW";
  sortOrder: number;
  teamId: string;
  createdAt: Date;
  updatedAt: Date;
}

const groupDescriptionBlockDelegate = (prisma as unknown as {
  groupDescriptionBlock: {
    findMany(args: unknown): Promise<GroupDescriptionBlockRecord[]>;
    create(args: unknown): Promise<GroupDescriptionBlockRecord>;
    findUnique(args: unknown): Promise<GroupDescriptionBlockRecord | null>;
    update(args: unknown): Promise<GroupDescriptionBlockRecord>;
    delete(args: unknown): Promise<GroupDescriptionBlockRecord>;
  };
}).groupDescriptionBlock;

const blockSchema = z.object({
  content: z.string().min(1).max(1500),
  position: z.enum(["ABOVE", "BELOW"]).default("BELOW"),
  sortOrder: z.number().int().min(0).default(0),
});

const postCommandsSchema = z.object({
  message: z.string().optional().nullable(),
});

const demoSchema = z.object({
  kind: z.enum(["announcement", "matchResult", "pollResult"]),
});

teamWhatsAppRouter.use(authenticate, teamContext, requireAdmin);

teamWhatsAppRouter.get("/commands", async (_req, res) => {
  const helpMessage = await formatCommandHelpMessage();
  res.json({ success: true, data: { commands: BOT_COMMANDS, helpMessage } });
});

teamWhatsAppRouter.post("/commands/post", validate(postCommandsSchema), async (req, res, next) => {
  try {
    await postCommandHelpToGroup(req.teamId!, req.body.message || undefined);
    await logAudit(req.user!.id, "CREATE", "whatsapp_command_post", req.teamId!, undefined, req.teamId);
    res.json({ success: true, message: "Command list posted" });
  } catch (error) { next(error); }
});

teamWhatsAppRouter.post("/demo/:kind", async (req, res, next) => {
  try {
    const { kind } = demoSchema.parse({ kind: String(req.params.kind) });
    const team = await prisma.team.findUnique({
      where: { id: req.teamId! },
      select: {
        whatsappGroupJid: true,
        announcementNotificationMode: true,
        matchResultNotificationMode: true,
        pollResultNotificationMode: true,
      },
    });

    if (!team?.whatsappGroupJid) {
      throw new AppError(400, "No WhatsApp group configured");
    }

    if (kind === "announcement") {
      const media = await createAnnouncementImage({
        title: "Scrim-Update für heute Abend",
        content: "Server steht, Lobby kommt 15 Minuten vorher. Bitte kurz auf den Ready-Check reagieren.",
        createdBy: req.user!.displayName,
      });
      const text = `📣 Demo-Ankündigung\nHeute siehst du genau, wie eine echte Ankündigung in der Gruppe ankommt.\n\nDies ist eine automatisierte Nachricht von Next Phantoms HQ.`;
      await evolutionService.sendWhatsAppNotification(team.whatsappGroupJid, text, (team.announcementNotificationMode as any) || "TEXT", media);
    }

    if (kind === "matchResult") {
      const media = await createMatchResultImage({
        opponent: "Demo Squad",
        scoreUs: 7,
        scoreThem: 4,
        map: "Clubhouse",
        competition: "Scrim",
        result: "WIN",
      });
      const text = `🏆 Demo-Match-Ergebnis\nNext Phantoms 7:4 Demo Squad\nWIN\nClubhouse\nScrim\n\nDies ist eine automatisierte Nachricht von Next Phantoms HQ.`;
      await evolutionService.sendWhatsAppNotification(team.whatsappGroupJid, text, (team.matchResultNotificationMode as any) || "TEXT", media);
    }

    if (kind === "pollResult") {
      const lines = ["Chalet: 6 Stimmen (50%)", "Clubhouse: 4 Stimmen (33%)", "Bank: 2 Stimmen (17%)"];
      const media = await createPollResultImage({ question: "Welche Map wollt ihr heute spielen?", lines });
      const text = `📊 Demo-Umfrage-Ergebnis\nWelche Map wollt ihr heute spielen?\n\n${lines.join("\n")}\n\nDies ist eine automatisierte Nachricht von Next Phantoms HQ.`;
      await evolutionService.sendWhatsAppNotification(team.whatsappGroupJid, text, (team.pollResultNotificationMode as any) || "TEXT", media);
    }

    res.json({ success: true });
  } catch (error) { next(error); }
});

teamWhatsAppRouter.get("/description/blocks", async (req, res, next) => {
  try {
    const blocks = await groupDescriptionBlockDelegate.findMany({
      where: { teamId: req.teamId! },
      orderBy: [{ position: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    });
    res.json({ success: true, data: blocks });
  } catch (error) { next(error); }
});

teamWhatsAppRouter.post("/description/blocks", validate(blockSchema), async (req, res, next) => {
  try {
    const block = await groupDescriptionBlockDelegate.create({
      data: {
        teamId: req.teamId!,
        content: req.body.content,
        position: req.body.position,
        sortOrder: req.body.sortOrder,
      },
    });
    scheduleGroupDescriptionUpdate(req.teamId!);
    res.status(201).json({ success: true, data: block });
  } catch (error) { next(error); }
});

teamWhatsAppRouter.put("/description/blocks/:id", validate(blockSchema), async (req, res, next) => {
  try {
    const existing = await groupDescriptionBlockDelegate.findUnique({ where: { id: String(req.params.id) } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Block not found");

    const block = await groupDescriptionBlockDelegate.update({
      where: { id: existing.id },
      data: req.body,
    });
    scheduleGroupDescriptionUpdate(req.teamId!);
    res.json({ success: true, data: block });
  } catch (error) { next(error); }
});

teamWhatsAppRouter.delete("/description/blocks/:id", async (req, res, next) => {
  try {
    const existing = await groupDescriptionBlockDelegate.findUnique({ where: { id: String(req.params.id) } });
    if (!existing || existing.teamId !== req.teamId) throw new AppError(404, "Block not found");

    await groupDescriptionBlockDelegate.delete({ where: { id: existing.id } });
    scheduleGroupDescriptionUpdate(req.teamId!);
    res.json({ success: true, message: "Block deleted" });
  } catch (error) { next(error); }
});

teamWhatsAppRouter.get("/description/preview", async (req, res, next) => {
  try {
    const description = await buildGroupDescription(req.teamId!);
    res.json({ success: true, data: { description, length: description.length, maxLength: 2048 } });
  } catch (error) { next(error); }
});

teamWhatsAppRouter.post("/description/update", async (req, res, next) => {
  try {
    await updateGroupDescription(req.teamId!);
    await logAudit(req.user!.id, "UPDATE", "group_description", req.teamId!, undefined, req.teamId);
    res.json({ success: true, message: "Group description updated" });
  } catch (error) { next(error); }
});
