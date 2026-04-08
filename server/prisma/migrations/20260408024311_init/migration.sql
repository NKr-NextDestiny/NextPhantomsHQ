/*
  Warnings:

  - Added the required column `meetTime` to the `trainings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "match_player_stats" ADD COLUMN     "externalName" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "moss_files" ADD COLUMN     "playerName" TEXT;

-- AlterTable
ALTER TABLE "scrims" ADD COLUMN     "meetTime" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "trainings" ADD COLUMN     "meetTime" TIMESTAMP(3) NOT NULL;
