import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { teamContext, requireTeamRole } from "../middleware/team.js";
import { requireFeature } from "../middleware/features.js";
import { upload } from "../middleware/upload.js";
import { AppError } from "../middleware/errorHandler.js";
import { logAudit } from "../services/audit.service.js";
import { encryptFile, decryptFile } from "../services/file-encryption.service.js";
import { config } from "../config/index.js";

export const mossRouter = Router();

// List MOSS files for a match
mossRouter.get("/match/:matchId", authenticate, teamContext, requireFeature("matches"), async (req, res, next) => {
  try {
    const match = await prisma.match.findUnique({ where: { id: req.params.matchId } });
    if (!match || match.teamId !== req.teamId) throw new AppError(404, "Match not found");

    const files = await prisma.mossFile.findMany({
      where: { matchId: req.params.matchId },
      include: { uploadedBy: { select: { id: true, displayName: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: files });
  } catch (error) { next(error); }
});

// Upload MOSS file
mossRouter.post("/match/:matchId", authenticate, teamContext, requireFeature("matches"), requireTeamRole("PLAYER"), upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError(400, "No file uploaded");

    const match = await prisma.match.findUnique({ where: { id: req.params.matchId } });
    if (!match || match.teamId !== req.teamId) throw new AppError(404, "Match not found");

    // Encrypt the file
    const originalPath = req.file.path;
    if (config.fileEncryptionKey) {
      encryptFile(originalPath, originalPath);
    }

    const fileUrl = `/uploads/general/${req.file.filename}`;

    const mossFile = await prisma.mossFile.create({
      data: {
        fileName: req.file.originalname,
        fileUrl,
        fileSize: req.file.size,
        playerName: req.body.playerName || null,
        matchId: req.params.matchId,
        uploadedById: req.user!.id,
        teamId: req.teamId!,
      },
      include: { uploadedBy: { select: { id: true, displayName: true, avatarUrl: true } } },
    });

    await logAudit(req.user!.id, "CREATE", "moss_file", mossFile.id, { fileName: mossFile.fileName, matchId: req.params.matchId }, req.teamId);

    res.status(201).json({ success: true, data: mossFile });
  } catch (error) { next(error); }
});

// Download MOSS file (with decryption)
mossRouter.get("/:id/download", authenticate, teamContext, requireFeature("matches"), async (req, res, next) => {
  try {
    const mossFile = await prisma.mossFile.findUnique({ where: { id: req.params.id } });
    if (!mossFile || mossFile.teamId !== req.teamId) throw new AppError(404, "MOSS file not found");

    const filePath = path.resolve(config.uploadDir, "general", path.basename(mossFile.fileUrl));
    if (!fs.existsSync(filePath)) throw new AppError(404, "File not found on disk");

    if (config.fileEncryptionKey) {
      const decrypted = decryptFile(filePath);
      res.setHeader("Content-Disposition", `attachment; filename="${mossFile.fileName}"`);
      res.setHeader("Content-Type", "application/octet-stream");
      res.send(decrypted);
    } else {
      res.download(filePath, mossFile.fileName);
    }
  } catch (error) { next(error); }
});

// Delete MOSS file
mossRouter.delete("/:id", authenticate, teamContext, requireFeature("matches"), requireTeamRole("COACH"), async (req, res, next) => {
  try {
    const mossFile = await prisma.mossFile.findUnique({ where: { id: req.params.id } });
    if (!mossFile || mossFile.teamId !== req.teamId) throw new AppError(404, "MOSS file not found");

    try {
      const filePath = path.resolve(config.uploadDir, "general", path.basename(mossFile.fileUrl));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {}

    await prisma.mossFile.delete({ where: { id: req.params.id } });

    await logAudit(req.user!.id, "DELETE", "moss_file", req.params.id, { fileName: mossFile.fileName }, req.teamId);

    res.json({ success: true, message: "MOSS file deleted" });
  } catch (error) { next(error); }
});
