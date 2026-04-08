-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('SCRIM', 'TOURNAMENT', 'LEAGUE', 'FRIENDLY', 'OTHER');

-- Add new columns to matches
ALTER TABLE "matches" ADD COLUMN "type" "MatchType" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "matches" ADD COLUMN "meet_time" TIMESTAMP(3);
ALTER TABLE "matches" ADD COLUMN "end_date" TIMESTAMP(3);
ALTER TABLE "matches" ADD COLUMN "map_pool" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "matches" ADD COLUMN "format" TEXT;
ALTER TABLE "matches" ADD COLUMN "contact_info" TEXT;
ALTER TABLE "matches" ADD COLUMN "server_region" TEXT;
ALTER TABLE "matches" ADD COLUMN "recurrence" "RecurrenceType" NOT NULL DEFAULT 'NONE';
ALTER TABLE "matches" ADD COLUMN "reminder_intervals" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "matches" ADD COLUMN "skill_rating" INTEGER;
ALTER TABLE "matches" ADD COLUMN "communication_rating" INTEGER;
ALTER TABLE "matches" ADD COLUMN "punctuality_rating" INTEGER;
ALTER TABLE "matches" ADD COLUMN "map_results" JSONB;

-- Make previously required fields nullable
ALTER TABLE "matches" ALTER COLUMN "map" DROP NOT NULL;
ALTER TABLE "matches" ALTER COLUMN "score_us" DROP NOT NULL;
ALTER TABLE "matches" ALTER COLUMN "score_them" DROP NOT NULL;
ALTER TABLE "matches" ALTER COLUMN "result" DROP NOT NULL;

-- Create match_votes table
CREATE TABLE "match_votes" (
    "id" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "comment" TEXT,
    "user_id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "match_votes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "match_votes_user_id_match_id_key" ON "match_votes"("user_id", "match_id");
ALTER TABLE "match_votes" ADD CONSTRAINT "match_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_votes" ADD CONSTRAINT "match_votes_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate scrim data into matches (using same IDs to preserve FK references)
INSERT INTO "matches" ("id", "opponent", "date", "type", "meet_time", "end_date", "map_pool", "format", "contact_info", "server_region", "notes", "recurrence", "reminder_intervals", "created_by_id", "team_id", "created_at", "updated_at")
SELECT "id", "opponent", "date", 'SCRIM'::"MatchType", "meet_time", "end_date", "map_pool", "format", "contact_info", "server_region", "notes", "recurrence", "reminder_intervals", "created_by_id", "team_id", "created_at", "updated_at"
FROM "scrims";

-- Migrate ScrimResult data into match columns
UPDATE "matches" SET
  "score_us" = sr."score_us",
  "score_them" = sr."score_them",
  "result" = CASE
    WHEN sr."score_us" > sr."score_them" THEN 'WIN'::"MatchResult"
    WHEN sr."score_us" < sr."score_them" THEN 'LOSS'::"MatchResult"
    ELSE 'DRAW'::"MatchResult"
  END,
  "skill_rating" = sr."skill_rating",
  "communication_rating" = sr."communication_rating",
  "punctuality_rating" = sr."punctuality_rating",
  "map_results" = sr."maps"
FROM "scrim_results" sr
WHERE "matches"."id" = sr."scrim_id";

-- Migrate ScrimVote data into match_votes
INSERT INTO "match_votes" ("id", "status", "comment", "user_id", "match_id", "created_at", "updated_at")
SELECT "id", "status", "comment", "user_id", "scrim_id", "created_at", "updated_at"
FROM "scrim_votes";

-- Update event_reminders: SCRIM -> MATCH
UPDATE "event_reminders" SET "event_type" = 'MATCH' WHERE "event_type" = 'SCRIM';

-- Update attendance_tokens: SCRIM -> MATCH
UPDATE "attendance_tokens" SET "event_type" = 'MATCH' WHERE "event_type" = 'SCRIM';

-- Set type=SCRIM for existing matches that were linked to scrims
UPDATE "matches" SET "type" = 'SCRIM'::"MatchType" WHERE "scrim_id" IS NOT NULL AND "type" = 'OTHER';

-- Drop scrimId FK and column
ALTER TABLE "matches" DROP CONSTRAINT IF EXISTS "matches_scrim_id_fkey";
DROP INDEX IF EXISTS "matches_scrim_id_idx";
ALTER TABLE "matches" DROP COLUMN IF EXISTS "scrim_id";

-- Drop old tables (order matters due to FK constraints)
DROP TABLE IF EXISTS "scrim_results";
DROP TABLE IF EXISTS "scrim_votes";
DROP TABLE IF EXISTS "scrims";

-- Add new index
CREATE INDEX "matches_team_id_type_date_idx" ON "matches"("team_id", "type", "date");
