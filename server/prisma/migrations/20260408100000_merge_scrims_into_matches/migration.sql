-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('SCRIM', 'TOURNAMENT', 'LEAGUE', 'FRIENDLY', 'OTHER');

-- Add new columns to matches
ALTER TABLE "matches" ADD COLUMN "type" "MatchType" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "matches" ADD COLUMN "meetTime" TIMESTAMP(3);
ALTER TABLE "matches" ADD COLUMN "endDate" TIMESTAMP(3);
ALTER TABLE "matches" ADD COLUMN "mapPool" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "matches" ADD COLUMN "format" TEXT;
ALTER TABLE "matches" ADD COLUMN "contactInfo" TEXT;
ALTER TABLE "matches" ADD COLUMN "serverRegion" TEXT;
ALTER TABLE "matches" ADD COLUMN "recurrence" "RecurrenceType" NOT NULL DEFAULT 'NONE';
ALTER TABLE "matches" ADD COLUMN "reminderIntervals" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "matches" ADD COLUMN "skillRating" INTEGER;
ALTER TABLE "matches" ADD COLUMN "communicationRating" INTEGER;
ALTER TABLE "matches" ADD COLUMN "punctualityRating" INTEGER;
ALTER TABLE "matches" ADD COLUMN "mapResults" JSONB;

-- Make previously required fields nullable
ALTER TABLE "matches" ALTER COLUMN "map" DROP NOT NULL;
ALTER TABLE "matches" ALTER COLUMN "scoreUs" DROP NOT NULL;
ALTER TABLE "matches" ALTER COLUMN "scoreThem" DROP NOT NULL;
ALTER TABLE "matches" ALTER COLUMN "result" DROP NOT NULL;

-- Create match_votes table
CREATE TABLE "match_votes" (
    "id" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "comment" TEXT,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "match_votes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "match_votes_userId_matchId_key" ON "match_votes"("userId", "matchId");
ALTER TABLE "match_votes" ADD CONSTRAINT "match_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_votes" ADD CONSTRAINT "match_votes_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate scrim data into matches (using same IDs to preserve FK references)
INSERT INTO "matches" ("id", "opponent", "date", "type", "meetTime", "endDate", "mapPool", "format", "contactInfo", "serverRegion", "notes", "recurrence", "reminderIntervals", "createdById", "teamId", "createdAt", "updatedAt")
SELECT "id", "opponent", "date", 'SCRIM'::"MatchType", "meetTime", "endDate", "mapPool", "format", "contactInfo", "serverRegion", "notes", "recurrence", "reminderIntervals", "createdById", "teamId", "createdAt", "updatedAt"
FROM "scrims";

-- Migrate ScrimResult data into match columns
UPDATE "matches" SET
  "scoreUs" = sr."scoreUs",
  "scoreThem" = sr."scoreThem",
  "result" = CASE
    WHEN sr."scoreUs" > sr."scoreThem" THEN 'WIN'::"MatchResult"
    WHEN sr."scoreUs" < sr."scoreThem" THEN 'LOSS'::"MatchResult"
    ELSE 'DRAW'::"MatchResult"
  END,
  "skillRating" = sr."skillRating",
  "communicationRating" = sr."communicationRating",
  "punctualityRating" = sr."punctualityRating",
  "mapResults" = sr."maps"
FROM "scrim_results" sr
WHERE "matches"."id" = sr."scrimId";

-- Migrate ScrimVote data into match_votes
INSERT INTO "match_votes" ("id", "status", "comment", "userId", "matchId", "createdAt", "updatedAt")
SELECT "id", "status", "comment", "userId", "scrimId", "createdAt", "updatedAt"
FROM "scrim_votes";

-- Update event_reminders: SCRIM -> MATCH
UPDATE "event_reminders" SET "eventType" = 'MATCH' WHERE "eventType" = 'SCRIM';

-- Update attendance_tokens: SCRIM -> MATCH
UPDATE "attendance_tokens" SET "eventType" = 'MATCH' WHERE "eventType" = 'SCRIM';

-- Set type=SCRIM for existing matches that were linked to scrims
UPDATE "matches" SET "type" = 'SCRIM'::"MatchType" WHERE "scrimId" IS NOT NULL AND "type" = 'OTHER';

-- Drop scrimId FK and column
ALTER TABLE "matches" DROP CONSTRAINT IF EXISTS "matches_scrimId_fkey";
DROP INDEX IF EXISTS "matches_scrimId_idx";
ALTER TABLE "matches" DROP COLUMN IF EXISTS "scrimId";

-- Drop old tables (order matters due to FK constraints)
DROP TABLE IF EXISTS "scrim_results";
DROP TABLE IF EXISTS "scrim_votes";
DROP TABLE IF EXISTS "scrims";

-- Add new index
CREATE INDEX "matches_teamId_type_date_idx" ON "matches"("teamId", "type", "date");
