-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('NONE', 'EMAIL', 'WHATSAPP');

-- Add phone to users
ALTER TABLE "users" ADD COLUMN "phone" TEXT;

-- Add notification_channel to teams
ALTER TABLE "teams" ADD COLUMN "notification_channel" "NotificationChannel" NOT NULL DEFAULT 'NONE';

-- Migrate: if team had autoEmailEvents=true and SMTP was configured, set to EMAIL
UPDATE "teams" SET "notification_channel" = 'EMAIL' WHERE "auto_email_events" = true;
