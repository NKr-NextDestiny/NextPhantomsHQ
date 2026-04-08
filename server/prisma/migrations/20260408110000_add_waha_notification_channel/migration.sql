-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('NONE', 'EMAIL', 'WHATSAPP');

-- Add phone to users
ALTER TABLE "users" ADD COLUMN "phone" TEXT;

-- Add notificationChannel to teams
ALTER TABLE "teams" ADD COLUMN "notificationChannel" "NotificationChannel" NOT NULL DEFAULT 'NONE';

-- Migrate: if team had autoEmailEvents=true and SMTP was configured, set to EMAIL
UPDATE "teams" SET "notificationChannel" = 'EMAIL' WHERE "autoEmailEvents" = true;
