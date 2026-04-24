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
