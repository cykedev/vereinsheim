-- CreateEnum
CREATE TYPE "LeagueFormat" AS ENUM ('DOUBLE_ROUND_ROBIN', 'BEST_OF_SINGLE');

-- AlterTable: Best-of-Single Liga-Konfiguration
ALTER TABLE "Competition" ADD COLUMN "leagueFormat" "LeagueFormat" NOT NULL DEFAULT 'DOUBLE_ROUND_ROBIN',
ADD COLUMN "groupBestOf" INTEGER DEFAULT 3,
ADD COLUMN "groupPlayAllDuels" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "groupTiebreaker1" "ScoringMode",
ADD COLUMN "groupTiebreaker2" "ScoringMode",
ADD COLUMN "groupHasSuddenDeath" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: Duell-Nummer + Stechschuss-Markierung
ALTER TABLE "Series" ADD COLUMN "duelNumber" INTEGER,
ADD COLUMN "isTiebreak" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: bestehende (matchup-gebundene) Serien auf duelNumber = 1 setzen,
-- damit der neue Unique-Index die Eindeutigkeit klassischer Serien erzwingt
-- (SQL behandelt NULLs als distinct).
UPDATE "Series" SET "duelNumber" = 1 WHERE "matchupId" IS NOT NULL;

-- DropIndex
DROP INDEX "Series_matchupId_participantId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Series_matchupId_participantId_duelNumber_key" ON "Series"("matchupId", "participantId", "duelNumber");
