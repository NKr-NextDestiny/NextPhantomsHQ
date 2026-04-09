-- AlterTable
ALTER TABLE "matches" ADD COLUMN "trainingId" TEXT;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "trainings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
