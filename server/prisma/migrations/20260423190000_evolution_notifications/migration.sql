-- CreateEnum
CREATE TYPE "AttendanceLinkChannel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "NotificationContentMode" AS ENUM ('TEXT', 'IMAGE', 'BOTH');

-- AlterTable
ALTER TABLE "announcements"
ADD COLUMN     "imageFileName" TEXT,
ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "polls"
ADD COLUMN     "resultsSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "teams"
ADD COLUMN     "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "announcementNotificationMode" "NotificationContentMode" NOT NULL DEFAULT 'TEXT',
ADD COLUMN     "matchResultNotificationMode" "NotificationContentMode" NOT NULL DEFAULT 'TEXT',
ADD COLUMN     "pollResultNotificationMode" "NotificationContentMode" NOT NULL DEFAULT 'TEXT',
ADD COLUMN     "whatsappGroupJid" TEXT,
ADD COLUMN     "whatsappNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "attendance_tokens"
ADD COLUMN     "channel" "AttendanceLinkChannel" NOT NULL DEFAULT 'EMAIL';

-- DropIndex
DROP INDEX "attendance_tokens_userId_eventType_eventId_key";

-- CreateIndex
CREATE UNIQUE INDEX "attendance_tokens_userId_eventType_eventId_channel_key" ON "attendance_tokens"("userId", "eventType", "eventId", "channel");
