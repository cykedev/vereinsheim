/*
  Warnings:

  - You are about to drop the column `playoffQualThreshold` on the `Competition` table. All the data in the column will be lost.
  - You are about to drop the column `playoffQualTopN1` on the `Competition` table. All the data in the column will be lost.
  - You are about to drop the column `playoffQualTopN2` on the `Competition` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "PlayoffRound" ADD VALUE 'EIGHTH_FINAL';

-- DropForeignKey
ALTER TABLE "Series" DROP CONSTRAINT "Series_matchupId_fkey";

-- AlterTable
-- DESTRUCTIVE: Dropping playoffQualThreshold (never used in code), playoffQualTopN1 and
-- playoffQualTopN2 (replaced by boolean flags playoffHasViertelfinale / playoffHasAchtelfinale).
-- Dev-only database; no production data at risk.
ALTER TABLE "Competition" DROP COLUMN "playoffQualThreshold",
DROP COLUMN "playoffQualTopN1",
DROP COLUMN "playoffQualTopN2",
ADD COLUMN     "playoffHasAchtelfinale" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "playoffHasViertelfinale" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "Series" ADD CONSTRAINT "Series_matchupId_fkey" FOREIGN KEY ("matchupId") REFERENCES "Matchup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
