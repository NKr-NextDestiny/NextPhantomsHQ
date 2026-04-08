import fs from "node:fs";
import type { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler.js";

// Magic bytes signatures for allowed file types
const SIGNATURES: { ext: string; magic: number[]; offset?: number }[] = [
  { ext: ".zip", magic: [0x50, 0x4B, 0x03, 0x04] },
  { ext: ".zip", magic: [0x50, 0x4B, 0x05, 0x06] }, // empty archive
  { ext: ".png", magic: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  { ext: ".jpg", magic: [0xFF, 0xD8, 0xFF] },
  { ext: ".jpeg", magic: [0xFF, 0xD8, 0xFF] },
  { ext: ".gif", magic: [0x47, 0x49, 0x46, 0x38] },
  { ext: ".pdf", magic: [0x25, 0x50, 0x44, 0x46] },
  { ext: ".webp", magic: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF header, WEBP at offset 8
];

// Extensions that don't have reliable magic bytes (game-specific formats)
const PASSTHROUGH_EXTENSIONS = new Set([".rec", ".dem", ".moss"]);

function matchesMagic(buffer: Buffer, magic: number[], offset = 0): boolean {
  if (buffer.length < offset + magic.length) return false;
  return magic.every((byte, i) => buffer[offset + i] === byte);
}

export function validateFileType(req: Request, _res: Response, next: NextFunction) {
  if (!req.file) return next();

  const ext = req.file.originalname.toLowerCase().slice(req.file.originalname.lastIndexOf("."));

  // Game-specific formats pass through (no reliable magic bytes)
  if (PASSTHROUGH_EXTENSIONS.has(ext)) return next();

  // Read first 16 bytes for magic byte checking
  try {
    const fd = fs.openSync(req.file.path, "r");
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);

    const isValid = SIGNATURES.some(sig =>
      sig.ext === ext && matchesMagic(buf, sig.magic, sig.offset)
    );

    if (!isValid && SIGNATURES.some(sig => sig.ext === ext)) {
      // We have signatures for this extension but none matched
      fs.unlinkSync(req.file.path);
      return next(new AppError(400, "File content does not match its extension"));
    }
  } catch {
    // If we can't read the file, let other middleware handle it
  }

  next();
}
