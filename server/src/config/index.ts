import path from "node:path";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: path.resolve(process.cwd(), "..", ".env") });

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET || "change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  discordClientId: process.env.DISCORD_CLIENT_ID || "",
  discordClientSecret: process.env.DISCORD_CLIENT_SECRET || "",
  discordCallbackUrl: process.env.DISCORD_CALLBACK_URL || "http://localhost:4000/api/auth/discord/callback",
  appUrl: process.env.APP_URL || "http://localhost:3000",
  apiUrl: process.env.API_URL || "http://localhost:4000",
  defaultLanguage: process.env.DEFAULT_LANGUAGE || "de",
  uploadDir: process.env.UPLOAD_DIR || "./uploads",
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || "50", 10),
  fileEncryptionKey: process.env.FILE_ENCRYPTION_KEY || "",
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10),
  requiredGuildId: process.env.REQUIRED_GUILD_ID || "",
  allowedRoleIds: (process.env.ALLOWED_ROLE_IDS || "").split(",").filter(Boolean),
  adminRoleIds: (process.env.ADMIN_ROLE_IDS || "").split(",").filter(Boolean),
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: parseInt(process.env.SMTP_PORT || "587", 10),
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smtpFrom: process.env.SMTP_FROM || "noreply@nextphantoms.de",
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
};

const requiredVars = [
  { key: "DATABASE_URL", value: config.databaseUrl },
  { key: "DISCORD_CLIENT_ID", value: config.discordClientId },
  { key: "DISCORD_CLIENT_SECRET", value: config.discordClientSecret },
] as const;

for (const { key, value } of requiredVars) {
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
}
