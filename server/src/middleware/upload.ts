import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { config } from "../config/index.js";

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    const dir = path.resolve(config.uploadDir, "general");
    ensureDir(dir);
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});

const replayStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    const dir = path.resolve(config.uploadDir, "replays");
    ensureDir(dir);
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSizeMb * 1024 * 1024 },
});

export const uploadReplay = multer({
  storage: replayStorage,
  limits: { fileSize: config.maxFileSizeMb * 1024 * 1024 },
});

export { validateFileType } from "./fileValidation.js";
