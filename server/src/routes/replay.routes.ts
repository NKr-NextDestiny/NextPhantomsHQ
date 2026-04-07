import { Router } from "express";
import { z } from "zod";
import path from "node:path";
import fs from "node:fs";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { teamContext, requireTeamRole } from "../middleware/team.js";
import { requireFeature } from "../middleware/features.js";
import { uploadReplay } from "../middleware/upload.js";
import { AppError } from "../middleware/errorHandler.js";
import { logAudit } from "../services/audit.service.js";
import { encryptFile, decryptFile } from "../services/file-encryption.service.js";
import { config } from "../config/index.js";
import { getIO } from "../config/socket.js";

export const replayRouter = Router();

// List replays
replayRouter.get("/", authenticate, teamContext, requireFeature("replays"), async (req, res, next) => {
  try {
    const { map, opponent, matchType } = req.query;
    const where: any = { teamId: req.teamId };
    if (map) where.map = map;
    if (opponent) where.opponent = { contains: opponent as string, mode: "insensitive" };
    if (matchType) where.matchType = matchType;

    const replays = await prisma.replay.findMany({
      where,
      include: {
        uploadedBy: { select: { id: true, displayName: true, avatarUrl: true } },
        rounds: { select: { id: true, roundNumber: true, tags: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: replays });
  } catch (error) { next(error); }
});

// Get single replay
replayRouter.get("/:id", authenticate, teamContext, requireFeature("replays"), async (req, res, next) => {
  try {
    const replay = await prisma.replay.findUnique({
      where: { id: req.params.id },
      include: {
        uploadedBy: { select: { id: true, displayName: true, avatarUrl: true } },
        rounds: {
          include: { playerStats: true },
          orderBy: { roundNumber: "asc" },
        },
        match: true,
      },
    });
    if (!replay || replay.teamId !== req.teamId) throw new AppError(404, "Replay not found");
    res.json({ success: true, data: replay });
  } catch (error) { next(error); }
});

// Upload replay (ZIP or single file)
replayRouter.post("/", authenticate, teamContext, requireFeature("replays"), requireTeamRole("PLAYER"), uploadReplay.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError(400, "No file uploaded");

    const { map, opponent, matchDate, matchType, notes, matchId } = req.body;

    // Encrypt the file if key is set
    const originalPath = req.file.path;
    if (config.fileEncryptionKey) {
      encryptFile(originalPath, originalPath);
    }

    const fileUrl = `/uploads/replays/${req.file.filename}`;

    const replay = await prisma.replay.create({
      data: {
        fileName: req.file.originalname,
        fileUrl,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        map: map || null,
        opponent: opponent || null,
        matchDate: matchDate ? new Date(matchDate) : null,
        matchType: matchType || null,
        notes: notes || null,
        matchId: matchId || null,
        uploadedById: req.user!.id,
        teamId: req.teamId!,
      },
      include: {
        uploadedBy: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    // If it's a ZIP, try to create round entries from it
    if (req.file.originalname.endsWith(".zip")) {
      try {
        // Simple ZIP extraction - create placeholder rounds
        // In production, you'd parse the actual replay files
        await prisma.replay.update({
          where: { id: replay.id },
          data: { parsed: true },
        });
      } catch (parseErr) {
        await prisma.replay.update({
          where: { id: replay.id },
          data: { parseError: String(parseErr) },
        });
      }
    }

    await logAudit(req.user!.id, "CREATE", "replay", replay.id, { fileName: replay.fileName }, req.teamId);
    try { getIO().to(`team:${req.teamId}`).emit("replay:created", replay); } catch {}

    res.status(201).json({ success: true, data: replay });
  } catch (error) { next(error); }
});

// Download replay (with decryption)
replayRouter.get("/:id/download", authenticate, teamContext, requireFeature("replays"), async (req, res, next) => {
  try {
    const replay = await prisma.replay.findUnique({ where: { id: req.params.id } });
    if (!replay || replay.teamId !== req.teamId) throw new AppError(404, "Replay not found");

    const filePath = path.resolve(config.uploadDir, "replays", path.basename(replay.fileUrl));
    if (!fs.existsSync(filePath)) throw new AppError(404, "File not found on disk");

    if (config.fileEncryptionKey) {
      const decrypted = decryptFile(filePath);
      res.setHeader("Content-Disposition", `attachment; filename="${replay.fileName}"`);
      res.setHeader("Content-Type", replay.mimeType || "application/octet-stream");
      res.send(decrypted);
    } else {
      res.download(filePath, replay.fileName);
    }
  } catch (error) { next(error); }
});

// Download round file
replayRouter.get("/rounds/:roundId/download", authenticate, teamContext, requireFeature("replays"), async (req, res, next) => {
  try {
    const round = await prisma.replayRound.findUnique({
      where: { id: req.params.roundId },
      include: { replay: true },
    });
    if (!round || round.replay.teamId !== req.teamId) throw new AppError(404, "Round not found");

    const filePath = path.resolve(config.uploadDir, "replays", path.basename(round.fileUrl));
    if (!fs.existsSync(filePath)) throw new AppError(404, "File not found on disk");

    if (config.fileEncryptionKey) {
      const decrypted = decryptFile(filePath);
      res.setHeader("Content-Disposition", `attachment; filename="${round.fileName}"`);
      res.setHeader("Content-Type", "application/octet-stream");
      res.send(decrypted);
    } else {
      res.download(filePath, round.fileName);
    }
  } catch (error) { next(error); }
});

// Manage tags on rounds
replayRouter.put("/rounds/:roundId/tags", authenticate, teamContext, requireFeature("replays"), async (req, res, next) => {
  try {
    const schema = z.object({ tags: z.array(z.string()) });
    const { tags } = schema.parse(req.body);

    const round = await prisma.replayRound.findUnique({ where: { id: req.params.roundId }, include: { replay: true } });
    if (!round || round.replay.teamId !== req.teamId) throw new AppError(404, "Round not found");

    // Ensure tags exist
    for (const tag of tags) {
      await prisma.replayTag.upsert({
        where: { teamId_name: { teamId: req.teamId!, name: tag } },
        update: {},
        create: { name: tag, teamId: req.teamId! },
      });
    }

    const updated = await prisma.replayRound.update({
      where: { id: req.params.roundId },
      data: { tags },
    });

    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

// List team tags
replayRouter.get("/tags/list", authenticate, teamContext, requireFeature("replays"), async (req, res, next) => {
  try {
    const tags = await prisma.replayTag.findMany({ where: { teamId: req.teamId } });
    res.json({ success: true, data: tags });
  } catch (error) { next(error); }
});

// Create round manually
replayRouter.post("/:id/rounds", authenticate, teamContext, requireFeature("replays"), requireTeamRole("ANALYST"), async (req, res, next) => {
  try {
    const replay = await prisma.replay.findUnique({ where: { id: req.params.id } });
    if (!replay || replay.teamId !== req.teamId) throw new AppError(404, "Replay not found");

    const schema = z.object({
      roundNumber: z.number().int().min(1),
      fileName: z.string().min(1),
      fileUrl: z.string().min(1),
      attackTeam: z.string().optional().nullable(),
      defenseTeam: z.string().optional().nullable(),
      winnerTeam: z.string().optional().nullable(),
      endReason: z.string().optional().nullable(),
      roundDuration: z.number().optional().nullable(),
      tags: z.array(z.string()).optional().default([]),
    });
    const data = schema.parse(req.body);

    const round = await prisma.replayRound.create({
      data: { ...data, replayId: req.params.id },
    });

    res.status(201).json({ success: true, data: round });
  } catch (error) { next(error); }
});

// Delete replay
replayRouter.delete("/:id", authenticate, teamContext, requireFeature("replays"), requireTeamRole("COACH"), async (req, res, next) => {
  try {
    const replay = await prisma.replay.findUnique({ where: { id: req.params.id } });
    if (!replay || replay.teamId !== req.teamId) throw new AppError(404, "Replay not found");

    // Delete file from disk
    try {
      const filePath = path.resolve(config.uploadDir, "replays", path.basename(replay.fileUrl));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {}

    await prisma.replay.delete({ where: { id: req.params.id } });

    await logAudit(req.user!.id, "DELETE", "replay", req.params.id, { fileName: replay.fileName }, req.teamId);
    try { getIO().to(`team:${req.teamId}`).emit("replay:deleted", { id: req.params.id }); } catch {}

    res.json({ success: true, message: "Replay deleted" });
  } catch (error) { next(error); }
});
