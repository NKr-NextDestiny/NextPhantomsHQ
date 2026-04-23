import { createServer } from "node:http";
import path from "node:path";
import fs from "node:fs";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import { config } from "./config/index.js";
import { logger } from "./config/logger.js";
import { initSocket } from "./config/socket.js";
import { csrfProtection } from "./middleware/csrf.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { ensureTeamExists } from "./services/team.service.js";
import { startScheduler } from "./services/scheduler.service.js";
import { decryptFile, isEncrypted } from "./services/file-encryption.service.js";
import { prisma } from "./config/prisma.js";

// Routes
import { authRouter } from "./routes/auth.routes.js";
import { trainingRouter } from "./routes/training.routes.js";

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
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { exportRouter } from "./routes/export.routes.js";
import { teamWhatsAppRouter } from "./routes/team-whatsapp.routes.js";
import { evolutionWebhookRouter } from "./routes/evolution-webhook.routes.js";

const app = express();
const httpServer = createServer(app);

// Socket.io
initSocket(httpServer);

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin: config.appUrl,
  credentials: true,
  exposedHeaders: ["x-csrf-token"],
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Pino HTTP logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      ms: Date.now() - start,
    }, `${req.method} ${req.originalUrl} ${res.statusCode}`);
  });
  next();
});

// CSRF protection (after cookie parser, before routes)
app.use("/api", csrfProtection);

// Rate limiting on auth routes
const authLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests, please try again later" },
});

// Rate limiting on mutation endpoints (POST/PUT/DELETE)
const mutationLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests, please try again later" },
  skip: (req) => req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS",
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
app.use("/api/trainings", mutationLimiter, trainingRouter);

app.use("/api/matches", mutationLimiter, matchRouter);
app.use("/api/strats", mutationLimiter, stratRouter);
app.use("/api/lineups", mutationLimiter, lineupRouter);
app.use("/api/scouting", mutationLimiter, scoutingRouter);
app.use("/api/replays", mutationLimiter, replayRouter);
app.use("/api/moss", mutationLimiter, mossRouter);
app.use("/api/comments", mutationLimiter, commentRouter);
app.use("/api/announcements", mutationLimiter, announcementRouter);
app.use("/api/polls", mutationLimiter, pollRouter);
app.use("/api/notifications", mutationLimiter, notificationRouter);
app.use("/api/attendance", mutationLimiter, attendanceRouter);
app.use("/api/users", mutationLimiter, userRouter);
app.use("/api/team", mutationLimiter, teamRouter);
app.use("/api/admin", mutationLimiter, adminRouter);
app.use("/api/training-templates", mutationLimiter, trainingTemplateRouter);
app.use("/api/matches", mutationLimiter, matchReviewRouter);
app.use("/api/availability", mutationLimiter, availabilityRouter);
app.use("/api/reminders", mutationLimiter, reminderRouter);
app.use("/api/wiki", mutationLimiter, wikiRouter);
app.use("/api/notes", mutationLimiter, notesRouter);
app.use("/api/search", searchRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/export", mutationLimiter, exportRouter);
app.use("/api/team/whatsapp", mutationLimiter, teamWhatsAppRouter);
app.use("/evolution/webhook", evolutionWebhookRouter);

// Error handler
app.use(errorHandler);

// Start
async function start() {
  try {
    await ensureTeamExists();
    startScheduler();

    httpServer.listen(config.port, () => {
      logger.info(`Next Phantoms HQ running on port ${config.port} (${config.nodeEnv})`);
    });
  } catch (error) {
    logger.fatal(error, "Failed to start server");
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info(`${signal} received — shutting down gracefully`);
  httpServer.close(() => {
    logger.info("HTTP server closed");
  });
  await prisma.$disconnect();
  logger.info("Database disconnected");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start();

export { app, httpServer };
