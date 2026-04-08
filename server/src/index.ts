import { createServer } from "node:http";
import path from "node:path";
import fs from "node:fs";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { config } from "./config/index.js";
import { initSocket } from "./config/socket.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { ensureTeamExists } from "./services/team.service.js";
import { startScheduler } from "./services/scheduler.service.js";
import { decryptFile, isEncrypted } from "./services/file-encryption.service.js";

// Routes
import { authRouter } from "./routes/auth.routes.js";
import { trainingRouter } from "./routes/training.routes.js";
import { scrimRouter } from "./routes/scrim.routes.js";
import { matchRouter } from "./routes/match.routes.js";
import { stratRouter } from "./routes/strat.routes.js";
import { lineupRouter } from "./routes/lineup.routes.js";
import { scoutingRouter } from "./routes/scouting.routes.js";
import { replayRouter } from "./routes/replay.routes.js";
import { mossRouter } from "./routes/moss.routes.js";
import { commentRouter } from "./routes/comment.routes.js";
import { announcementRouter } from "./routes/announcement.routes.js";
import { pollRouter } from "./routes/poll.routes.js";
import { notificationRouter } from "./routes/notification.routes.js";
import { attendanceRouter } from "./routes/attendance.routes.js";
import { userRouter } from "./routes/user.routes.js";
import { teamRouter } from "./routes/team.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { trainingTemplateRouter } from "./routes/training-template.routes.js";
import { matchReviewRouter } from "./routes/match-review.routes.js";
import { availabilityRouter } from "./routes/availability.routes.js";
import { reminderRouter } from "./routes/reminder.routes.js";
import { wikiRouter } from "./routes/wiki.routes.js";
import { notesRouter } from "./routes/notes.routes.js";
import { searchRouter } from "./routes/search.routes.js";

const app = express();
const httpServer = createServer(app);

// Socket.io
initSocket(httpServer);

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin: config.appUrl,
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
if (config.nodeEnv !== "test") app.use(morgan("short"));

// Rate limiting on auth routes
const authLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests, please try again later" },
});

// Ensure upload directories exist
const uploadDir = path.resolve(config.uploadDir);
for (const sub of ["general", "replays"]) {
  const dir = path.join(uploadDir, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Serve uploaded files with decryption support
app.use("/uploads", (req, res, next) => {
  const filePath = path.join(uploadDir, req.path);
  if (!fs.existsSync(filePath)) return next();

  try {
    if (config.fileEncryptionKey && isEncrypted(filePath)) {
      const decrypted = decryptFile(filePath);
      res.send(decrypted);
    } else {
      res.sendFile(filePath);
    }
  } catch (err) {
    next(err);
  }
});

// Health check
app.get("/", (_req, res) => {
  res.json({ success: true, data: { name: "Next Phantoms HQ API", status: "ok", timestamp: new Date().toISOString() } });
});
app.get("/api/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok", timestamp: new Date().toISOString() } });
});

// Routes
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/trainings", trainingRouter);
app.use("/api/scrims", scrimRouter);
app.use("/api/matches", matchRouter);
app.use("/api/strats", stratRouter);
app.use("/api/lineups", lineupRouter);
app.use("/api/scouting", scoutingRouter);
app.use("/api/replays", replayRouter);
app.use("/api/moss", mossRouter);
app.use("/api/comments", commentRouter);
app.use("/api/announcements", announcementRouter);
app.use("/api/polls", pollRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/users", userRouter);
app.use("/api/team", teamRouter);
app.use("/api/admin", adminRouter);
app.use("/api/training-templates", trainingTemplateRouter);
app.use("/api/matches", matchReviewRouter);
app.use("/api/availability", availabilityRouter);
app.use("/api/reminders", reminderRouter);
app.use("/api/wiki", wikiRouter);
app.use("/api/notes", notesRouter);
app.use("/api/search", searchRouter);

// Error handler
app.use(errorHandler);

// Start
async function start() {
  try {
    await ensureTeamExists();
    startScheduler();

    httpServer.listen(config.port, () => {
      console.log(`🚀 Next Phantoms HQ running on port ${config.port} (${config.nodeEnv})`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();

export { app, httpServer };
