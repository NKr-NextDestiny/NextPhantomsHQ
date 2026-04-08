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
import { encryptUploadedFile, readDecryptedFile } from "../services/file-encryption.service.js";
import { encryptFileOnDisk } from "../services/file-encryption.service.js";
import { extractZip, parseReplayInBackground } from "../services/replay-parser.service.js";
import { config } from "../config/index.js";
import { safeEmit } from "../config/socket.js";

export const replayRouter = Router();

// List replays
replayRouter.get("/", authenticate, teamContext, requireFeature("replays"), async (req, res, next) => {
  try {
    const { map, opponent, matchType, matchId, tags, dateFrom, dateTo } = req.query;
    const where: any = { teamId: req.teamId };
    if (map)       where.map      = map;
    if (matchId)   where.matchId  = matchId;
    if (opponent)  where.opponent = { contains: opponent as string, mode: "insensitive" };
    if (matchType) where.matchType = matchType;
    if (dateFrom || dateTo) {
      where.matchDate = {};
      if (dateFrom) where.matchDate.gte = new Date(dateFrom as string);
      if (dateTo)   where.matchDate.lte = new Date(dateTo as string);
    }

    const replays = await prisma.replay.findMany({
      where,
      include: {
        uploadedBy: { select: { id: true, displayName: true, avatarUrl: true } },
        match:      { select: { id: true, opponent: true, map: true, date: true, result: true, scoreUs: true, scoreThem: true } },
        rounds:     { orderBy: { roundNumber: "asc" }, select: { id: true, roundNumber: true, fileName: true, tags: true, roundEndReason: true, events: true, playerStats: { select: { r6Username: true, kills: true, deaths: true, headshots: true, userId: true, operator: true }, take: 20 } } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Filter by tags if specified
    let result = replays;
    if (tags) {
      const tagList = (tags as string).split(",").map(t => t.trim()).filter(Boolean);
      result = replays.map(r => ({
        ...r,
        rounds: r.rounds.filter(round => tagList.every(tag => round.tags.includes(tag))),
      })).filter(r => r.rounds.length > 0 || tagList.length === 0);
    }

    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

// Team tags
replayRouter.get("/tags", authenticate, teamContext, requireFeature("replays"), async (req, res, next) => {
  try {
    const tags = await prisma.replayTag.findMany({ where: { teamId: req.teamId! }, orderBy: { name: "asc" } });
    res.json({ success: true, data: tags });
  } catch (error) { next(error); }
});

// Get single replay
replayRouter.get("/:id", authenticate, teamContext, requireFeature("replays"), async (req, res, next) => {
  try {
    const replay = await prisma.replay.findUnique({
      where: { id: String(req.params.id) },
      include: {
        uploadedBy: { select: { id: true, displayName: true, avatarUrl: true } },
        match:      { select: { id: true, opponent: true, map: true, date: true, result: true, scoreUs: true, scoreThem: true } },
        rounds: {
          orderBy: { roundNumber: "asc" },
          include: {
            playerStats: {
              include: { user: { select: { id: true, displayName: true, username: true } } },
              orderBy: { kills: "desc" },
            },
          },
        },
      },
    });
    if (!replay || replay.teamId !== req.teamId) throw new AppError(404, "Replay not found");
    res.json({ success: true, data: replay });
  } catch (error) { next(error); }
});

// Get rounds of a replay
replayRouter.get("/:id/rounds", authenticate, teamContext, requireFeature("replays"), async (req, res, next) => {
  try {
    const replay = await prisma.replay.findUnique({ where: { id: String(req.params.id) } });
    if (!replay || replay.teamId !== req.teamId) throw new AppError(404, "Replay not found");

    const rounds = await prisma.replayRound.findMany({
      where: { replayId: String(req.params.id) },
      include: {
        playerStats: {
          include: { user: { select: { id: true, displayName: true, username: true, avatarUrl: true } } },
          orderBy: { kills: "desc" },
        },
      },
      orderBy: { roundNumber: "asc" },
    });
    res.json({ success: true, data: rounds });
  } catch (error) { next(error); }
});

// Upload (ZIP or single .rec)
replayRouter.post("/", authenticate, teamContext, requireFeature("replays"), uploadReplay.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError(400, "No file provided");

    const matchId  = req.body.matchId || null;
    const isZip    = req.file.mimetype === "application/zip"
                  || req.file.mimetype === "application/x-zip-compressed"
                  || req.file.originalname.toLowerCase().endsWith(".zip");

    // Validate matchId if provided
    if (matchId) {
      const match = await prisma.match.findUnique({ where: { id: matchId } });
      if (!match || match.teamId !== req.teamId) throw new AppError(400, "Match not found");
    }

    const replay = await prisma.replay.create({
      data: {
        fileName:    req.file.originalname,
        fileUrl:     `/uploads/${req.file.filename}`,
        fileSize:    req.file.size,
        mimeType:    req.file.mimetype,
        map:         req.body.map     || null,
        opponent:    req.body.opponent || null,
        matchDate:   req.body.matchDate ? new Date(req.body.matchDate) : null,
        matchType:   req.body.matchType || null,
        notes:       req.body.notes    || null,
        matchId,
        parsed:      false,
        uploadedById: req.user!.id,
        teamId:       req.teamId!,
      },
      include: { uploadedBy: { select: { id: true, displayName: true, avatarUrl: true } } },
    });

    await logAudit(req.user!.id, "CREATE", "Replay", replay.id);

    const uploadedFilePath = path.resolve(config.uploadDir, req.file.filename);

    if (isZip) {
      // Extract .rec files from ZIP (before encrypting the ZIP)
      const zipBuffer = fs.readFileSync(uploadedFilePath);
      const entries   = extractZip(zipBuffer).filter(e => e.name.toLowerCase().endsWith(".rec"));

      entries.sort((a, b) => a.name.localeCompare(b.name));

      for (let i = 0; i < entries.length; i++) {
        const entry    = entries[i];
        const safeName = `replay_${replay.id}_r${String(i + 1).padStart(2, "0")}_${Date.now()}.rec`;
        const outPath  = path.resolve(config.uploadDir, safeName);
        fs.writeFileSync(outPath, entry.data);

        // Extract round number from filename if present (e.g. -R03.rec → 3)
        const rnMatch = entry.name.match(/-?R?0*(\d+)\.rec$/i);
        const roundNumber = rnMatch ? parseInt(rnMatch[1]) : i + 1;

        await prisma.replayRound.create({
          data: {
            replayId:    replay.id,
            roundNumber,
            fileName:    entry.name,
            fileUrl:     `/uploads/${safeName}`,
          },
        });

        // Encrypt extracted round file
        await encryptFileOnDisk(outPath);
      }

      // Encrypt the original ZIP
      await encryptUploadedFile(req.file);
    } else {
      // Single .rec file — create one round
      await prisma.replayRound.create({
        data: {
          replayId:    replay.id,
          roundNumber: 1,
          fileName:    req.file.originalname,
          fileUrl:     `/uploads/${req.file.filename}`,
        },
      });

      // Encrypt the uploaded file
      await encryptUploadedFile(req.file);
    }

    // Send response immediately
    res.status(201).json({ success: true, data: replay });

    // Fire-and-forget: parse .rec files in background
    safeEmit(`team:${req.teamId}`, "replay:created", replay);
    parseReplayInBackground(replay.id, req.teamId!, matchId).catch(console.error);

  } catch (error) { next(error); }
});

// Update round tags
replayRouter.put("/:id/rounds/:roundId/tags", authenticate, teamContext, requireFeature("replays"), async (req, res, next) => {
  try {
    const replay = await prisma.replay.findUnique({ where: { id: String(req.params.id) } });
    if (!replay || replay.teamId !== req.teamId) throw new AppError(404, "Replay not found");

    const tags: string[] = Array.isArray(req.body.tags) ? req.body.tags : [];
    const round = await prisma.replayRound.update({
      where: { id: String(req.params.roundId) },
      data: { tags },
    });

    for (const tag of tags) {
      await prisma.replayTag.upsert({
        where:  { teamId_name: { teamId: req.teamId!, name: tag } },
        create: { name: tag, teamId: req.teamId! },
        update: {},
      });
    }

    res.json({ success: true, data: round });
  } catch (error) { next(error); }
});

// Map single player stat to user
replayRouter.put("/:id/stats/:statId/map-user", authenticate, teamContext, requireFeature("replays"), async (req, res, next) => {
  try {
    const replay = await prisma.replay.findUnique({ where: { id: String(req.params.id) } });
    if (!replay || replay.teamId !== req.teamId) throw new AppError(404, "Replay not found");

    const { userId } = req.body;
    if (!userId) throw new AppError(400, "userId required");

    const stat = await prisma.replayPlayerStat.update({
      where: { id: String(req.params.statId) },
      data: { userId },
      include: { user: { select: { id: true, displayName: true, username: true } } },
    });

    res.json({ success: true, data: stat });
  } catch (error) { next(error); }
});

// Bulk map username across all rounds
replayRouter.put("/:id/map-username", authenticate, teamContext, requireFeature("replays"), async (req, res, next) => {
  try {
    const replay = await prisma.replay.findUnique({ where: { id: String(req.params.id) } });
    if (!replay || replay.teamId !== req.teamId) throw new AppError(404, "Replay not found");

    const { r6Username, userId } = req.body;
    if (!r6Username || !userId) throw new AppError(400, "r6Username and userId required");

    const result = await prisma.replayPlayerStat.updateMany({
      where: {
        round: { replayId: String(req.params.id) },
        r6Username: { equals: r6Username, mode: "insensitive" },
      },
      data: { userId },
    });

    res.json({ success: true, data: { updated: result.count } });
  } catch (error) { next(error); }
});

// Download full file (decrypted)
replayRouter.get("/:id/download", authenticate, teamContext, requireFeature("replays"), async (req, res, next) => {
  try {
    const replay = await prisma.replay.findUnique({ where: { id: String(req.params.id) } });
    if (!replay || replay.teamId !== req.teamId) throw new AppError(404, "Replay not found");
    const filePath = path.join(config.uploadDir, path.basename(replay.fileUrl));
    if (!fs.existsSync(filePath)) throw new AppError(404, "File not found on disk");
    const data = readDecryptedFile(filePath);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(replay.fileName)}"`);
    res.setHeader("Content-Type", replay.mimeType || "application/octet-stream");
    res.send(data);
  } catch (error) { next(error); }
});

// Download single round .rec file (decrypted)
replayRouter.get("/:id/rounds/:roundId/download", authenticate, teamContext, requireFeature("replays"), async (req, res, next) => {
  try {
    const round = await prisma.replayRound.findUnique({ where: { id: String(req.params.roundId) }, include: { replay: true } });
    if (!round || round.replay.teamId !== req.teamId) throw new AppError(404, "Round not found");
    const filePath = path.join(config.uploadDir, path.basename(round.fileUrl));
    if (!fs.existsSync(filePath)) throw new AppError(404, "File not found on disk");
    const data = readDecryptedFile(filePath);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(round.fileName)}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(data);
  } catch (error) { next(error); }
});

// Delete replay
replayRouter.delete("/:id", authenticate, teamContext, requireFeature("replays"), async (req, res, next) => {
  try {
    const replay = await prisma.replay.findUnique({ where: { id: String(req.params.id) } });
    if (!replay || replay.teamId !== req.teamId) throw new AppError(404, "Replay not found");
    if (replay.uploadedById !== req.user!.id && !req.user!.isAdmin) {
      throw new AppError(403, "Not authorized");
    }

    // Delete round files from disk
    const rounds = await prisma.replayRound.findMany({ where: { replayId: String(req.params.id) } });
    for (const round of rounds) {
      try { fs.unlinkSync(path.join(config.uploadDir, path.basename(round.fileUrl))); } catch (e) { console.error("[cleanup] Failed to delete round file:", e); }
    }
    // Delete main file
    try { fs.unlinkSync(path.join(config.uploadDir, path.basename(replay.fileUrl))); } catch (e) { console.error("[cleanup] Failed to delete replay file:", e); }

    await prisma.replay.delete({ where: { id: String(req.params.id) } });
    await logAudit(req.user!.id, "DELETE", "Replay", String(req.params.id));
    safeEmit(`team:${req.teamId}`, "replay:deleted", { id: String(req.params.id) });

    res.json({ success: true, message: "Replay deleted" });
  } catch (error) { next(error); }
});
