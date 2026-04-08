import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Manually load DATABASE_URL from .env since Prisma's env() doesn't auto-load .env when config.ts is present
function loadDatabaseUrl(): string {
  // Check environment first (Docker sets this)
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  // Try server/.env
  const envPath = path.resolve(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    const match = content.match(/^DATABASE_URL=(.+)$/m);
    if (match) return match[1].trim();
  }

  throw new Error("DATABASE_URL not found in environment or server/.env");
}

export default defineConfig({
  schema: path.resolve(__dirname, "prisma/schema.prisma"),
  datasource: {
    url: loadDatabaseUrl(),
  },
});
