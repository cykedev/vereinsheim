-- Phase 2: League → Competition Rename
-- WICHTIG: Manuelles SQL — kein Prisma DROP/CREATE, nur RENAME + ALTER

-- ── Schritt 1: Neues Enum CompetitionStatus anlegen ───────────────────────
CREATE TYPE "CompetitionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- ── Schritt 2: Eingehende FK-Constraints auf League entfernen ─────────────
ALTER TABLE "LeagueParticipant" DROP CONSTRAINT "LeagueParticipant_leagueId_fkey";
ALTER TABLE "Matchup" DROP CONSTRAINT "Matchup_leagueId_fkey";
ALTER TABLE "PlayoffMatch" DROP CONSTRAINT "PlayoffMatch_leagueId_fkey";
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_leagueId_fkey";

-- Ausgehende FKs von League entfernen
ALTER TABLE "League" DROP CONSTRAINT "League_disciplineId_fkey";
ALTER TABLE "League" DROP CONSTRAINT "League_createdByUserId_fkey";

-- ── Schritt 3: Indizes entfernen ──────────────────────────────────────────
DROP INDEX "League_status_idx";
DROP INDEX "LeagueParticipant_leagueId_idx";
DROP INDEX "LeagueParticipant_leagueId_participantId_key";
DROP INDEX "Matchup_leagueId_idx";
DROP INDEX "Matchup_leagueId_homeParticipantId_idx";
DROP INDEX "Matchup_leagueId_awayParticipantId_idx";
DROP INDEX "PlayoffMatch_leagueId_idx";
DROP INDEX "PlayoffMatch_leagueId_round_idx";
DROP INDEX "AuditLog_leagueId_idx";

-- ── Schritt 4: Tabellen umbenennen ────────────────────────────────────────
ALTER TABLE "League" RENAME TO "Competition";
ALTER TABLE "LeagueParticipant" RENAME TO "CompetitionParticipant";

-- ── Schritt 5: Spalten umbenennen ─────────────────────────────────────────
ALTER TABLE "CompetitionParticipant" RENAME COLUMN "leagueId" TO "competitionId";
ALTER TABLE "Matchup" RENAME COLUMN "leagueId" TO "competitionId";
ALTER TABLE "PlayoffMatch" RENAME COLUMN "leagueId" TO "competitionId";
ALTER TABLE "AuditLog" RENAME COLUMN "leagueId" TO "competitionId";

-- Stichtage umbenennen
ALTER TABLE "Competition" RENAME COLUMN "firstLegDeadline" TO "hinrundeDeadline";
ALTER TABLE "Competition" RENAME COLUMN "secondLegDeadline" TO "rueckrundeDeadline";

-- ── Schritt 6: Status-Spalte auf CompetitionStatus konvertieren ───────────
-- PostgreSQL kann DEFAULT nicht auto-casten → erst droppen, dann Typ wechseln, dann neu setzen
ALTER TABLE "Competition" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Competition" ALTER COLUMN "status" TYPE "CompetitionStatus"
  USING "status"::text::"CompetitionStatus";
ALTER TABLE "Competition" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"CompetitionStatus";

-- ── Schritt 7: disciplineId nullable machen ───────────────────────────────
ALTER TABLE "Competition" ALTER COLUMN "disciplineId" DROP NOT NULL;

-- ── Schritt 8: Neue Spalten auf Competition ───────────────────────────────
-- Shared
ALTER TABLE "Competition" ADD COLUMN "type" "CompetitionType" NOT NULL DEFAULT 'LEAGUE';
ALTER TABLE "Competition" ADD COLUMN "scoringMode" "ScoringMode" NOT NULL DEFAULT 'RINGTEILER';
ALTER TABLE "Competition" ADD COLUMN "shotsPerSeries" INTEGER NOT NULL DEFAULT 10;

-- Liga-spezifisch (nullable)
ALTER TABLE "Competition" ADD COLUMN "playoffBestOf" INTEGER;
ALTER TABLE "Competition" ADD COLUMN "playoffQualThreshold" INTEGER;
ALTER TABLE "Competition" ADD COLUMN "playoffQualTopN1" INTEGER;
ALTER TABLE "Competition" ADD COLUMN "playoffQualTopN2" INTEGER;
ALTER TABLE "Competition" ADD COLUMN "finaleScoringMode" "ScoringMode";
ALTER TABLE "Competition" ADD COLUMN "finaleHasSuddenDeath" BOOLEAN;

-- Event-spezifisch (nullable)
ALTER TABLE "Competition" ADD COLUMN "eventDate" TIMESTAMP(3);
ALTER TABLE "Competition" ADD COLUMN "allowGuests" BOOLEAN;
ALTER TABLE "Competition" ADD COLUMN "teamSize" INTEGER;
ALTER TABLE "Competition" ADD COLUMN "targetValue" DECIMAL(8, 2);
ALTER TABLE "Competition" ADD COLUMN "targetValueType" "TargetValueType";

-- Saison-spezifisch (nullable)
ALTER TABLE "Competition" ADD COLUMN "minSeries" INTEGER;
ALTER TABLE "Competition" ADD COLUMN "seasonStart" TIMESTAMP(3);
ALTER TABLE "Competition" ADD COLUMN "seasonEnd" TIMESTAMP(3);

-- ── Schritt 9: Neue Spalten auf CompetitionParticipant ────────────────────
ALTER TABLE "CompetitionParticipant" ADD COLUMN "disciplineId" TEXT;
ALTER TABLE "CompetitionParticipant" ADD COLUMN "isGuest" BOOLEAN NOT NULL DEFAULT false;

-- ── Schritt 10: FK-Constraints mit neuen Namen erstellen ──────────────────
-- Competition ausgehende FKs
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_disciplineId_fkey"
  FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CompetitionParticipant FKs
ALTER TABLE "CompetitionParticipant" ADD CONSTRAINT "CompetitionParticipant_competitionId_fkey"
  FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompetitionParticipant" ADD CONSTRAINT "CompetitionParticipant_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompetitionParticipant" ADD CONSTRAINT "CompetitionParticipant_disciplineId_fkey"
  FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Matchup FK
ALTER TABLE "Matchup" ADD CONSTRAINT "Matchup_competitionId_fkey"
  FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PlayoffMatch FK
ALTER TABLE "PlayoffMatch" ADD CONSTRAINT "PlayoffMatch_competitionId_fkey"
  FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AuditLog FK
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_competitionId_fkey"
  FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Schritt 11: Primary Key Constraints umbenennen ────────────────────────
ALTER TABLE "Competition" RENAME CONSTRAINT "League_pkey" TO "Competition_pkey";
ALTER TABLE "CompetitionParticipant" RENAME CONSTRAINT "LeagueParticipant_pkey" TO "CompetitionParticipant_pkey";

-- ── Schritt 12: Indizes mit neuen Namen erstellen ─────────────────────────
CREATE INDEX "Competition_status_idx" ON "Competition"("status");
CREATE INDEX "Competition_type_idx" ON "Competition"("type");
CREATE INDEX "CompetitionParticipant_competitionId_idx" ON "CompetitionParticipant"("competitionId");
CREATE UNIQUE INDEX "CompetitionParticipant_competitionId_participantId_key"
  ON "CompetitionParticipant"("competitionId", "participantId");
CREATE INDEX "Matchup_competitionId_idx" ON "Matchup"("competitionId");
CREATE INDEX "Matchup_competitionId_homeParticipantId_idx" ON "Matchup"("competitionId", "homeParticipantId");
CREATE INDEX "Matchup_competitionId_awayParticipantId_idx" ON "Matchup"("competitionId", "awayParticipantId");
CREATE INDEX "PlayoffMatch_competitionId_idx" ON "PlayoffMatch"("competitionId");
CREATE INDEX "PlayoffMatch_competitionId_round_idx" ON "PlayoffMatch"("competitionId", "round");
CREATE INDEX "AuditLog_competitionId_idx" ON "AuditLog"("competitionId");

-- ── Schritt 13: Altes Enum entfernen ──────────────────────────────────────
DROP TYPE "LeagueStatus";
