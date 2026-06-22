/*
  Warnings:

  - You are about to drop the column `finaleScoringMode` on the `Competition` table. All the data in the column will be lost.

*/
-- AlterTable
-- DESTRUCTIVE: Dropping finaleScoringMode (replaced by finalePrimary + finaleTiebreaker1 + finaleTiebreaker2).
-- Dev-only database; no production data at risk.
-- Data migration: NULL → finalePrimary defaults to RINGS (handled by column DEFAULT 'RINGS').
ALTER TABLE "Competition" DROP COLUMN "finaleScoringMode",
ADD COLUMN     "finalePrimary" "ScoringMode" NOT NULL DEFAULT 'RINGS',
ADD COLUMN     "finaleTiebreaker1" "ScoringMode",
ADD COLUMN     "finaleTiebreaker2" "ScoringMode";
