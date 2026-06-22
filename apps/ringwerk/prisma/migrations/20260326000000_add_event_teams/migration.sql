-- Migration: add-event-teams
-- Adds TeamScoring enum, EventTeam model, eventTeamId on CompetitionParticipant,
-- competitionParticipantId on Series.
-- Replaces @@unique([competitionId, participantId]) on CompetitionParticipant
-- with two partial unique indexes to allow double-enrollment in team events.
-- All statements are idempotent (safe to re-run).

-- 1. New enum: TeamScoring
DO $$ BEGIN
  CREATE TYPE "TeamScoring" AS ENUM ('SUM', 'BEST');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. Add teamScoring to Competition
ALTER TABLE "Competition" ADD COLUMN IF NOT EXISTS "teamScoring" "TeamScoring";

-- 3. Create EventTeam table
CREATE TABLE IF NOT EXISTS "EventTeam" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "teamNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EventTeam_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EventTeam_competitionId_teamNumber_key" ON "EventTeam"("competitionId", "teamNumber");
CREATE INDEX IF NOT EXISTS "EventTeam_competitionId_idx" ON "EventTeam"("competitionId");
DO $$ BEGIN
  ALTER TABLE "EventTeam" ADD CONSTRAINT "EventTeam_competitionId_fkey"
      FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 4. Add eventTeamId to CompetitionParticipant
ALTER TABLE "CompetitionParticipant" ADD COLUMN IF NOT EXISTS "eventTeamId" TEXT;
DO $$ BEGIN
  ALTER TABLE "CompetitionParticipant" ADD CONSTRAINT "CompetitionParticipant_eventTeamId_fkey"
      FOREIGN KEY ("eventTeamId") REFERENCES "EventTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 5. Replace the global unique index with two partial unique indexes
--    Individual events (no team): one enrollment per participant per competition
--    Team events: one enrollment per participant per team
DROP INDEX IF EXISTS "CompetitionParticipant_competitionId_participantId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "cp_unique_individual"
    ON "CompetitionParticipant"("competitionId", "participantId")
    WHERE "eventTeamId" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "cp_unique_team"
    ON "CompetitionParticipant"("competitionId", "participantId", "eventTeamId")
    WHERE "eventTeamId" IS NOT NULL;

-- 6. Add competitionParticipantId to Series (nullable, backwards-compatible)
ALTER TABLE "Series" ADD COLUMN IF NOT EXISTS "competitionParticipantId" TEXT;
DO $$ BEGIN
  ALTER TABLE "Series" ADD CONSTRAINT "Series_competitionParticipantId_fkey"
      FOREIGN KEY ("competitionParticipantId") REFERENCES "CompetitionParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
-- Unique: one series per CP enrollment (NULLs are distinct in PostgreSQL — safe for old data)
CREATE UNIQUE INDEX IF NOT EXISTS "Series_competitionParticipantId_key" ON "Series"("competitionParticipantId");
