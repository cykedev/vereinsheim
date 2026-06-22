-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "ScoringType" AS ENUM ('WHOLE', 'DECIMAL');

-- CreateEnum
CREATE TYPE "LeagueStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('ACTIVE', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'COMPLETED', 'BYE', 'WALKOVER');

-- CreateEnum
CREATE TYPE "Round" AS ENUM ('FIRST_LEG', 'SECOND_LEG');

-- CreateEnum
CREATE TYPE "PlayoffRound" AS ENUM ('QUARTER_FINAL', 'SEMI_FINAL', 'FINAL');

-- CreateEnum
CREATE TYPE "ImportSource" AS ENUM ('MANUAL', 'URL', 'PDF');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginRateLimitBucket" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "blockedUntil" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginRateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Discipline" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scoringType" "ScoringType" NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discipline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "disciplineId" TEXT NOT NULL,
    "status" "LeagueStatus" NOT NULL DEFAULT 'ACTIVE',
    "firstLegDeadline" TIMESTAMP(3),
    "secondLegDeadline" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueParticipant" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'ACTIVE',
    "startNumber" INTEGER,
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Matchup" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "homeParticipantId" TEXT NOT NULL,
    "awayParticipantId" TEXT,
    "round" "Round" NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Matchup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchResult" (
    "id" TEXT NOT NULL,
    "matchupId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "shots" JSONB,
    "totalRings" DECIMAL(5,1) NOT NULL,
    "teiler" DECIMAL(6,1) NOT NULL,
    "ringteiler" DECIMAL(7,1) NOT NULL,
    "importSource" "ImportSource" NOT NULL DEFAULT 'MANUAL',
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayoffMatch" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "round" "PlayoffRound" NOT NULL,
    "participantAId" TEXT NOT NULL,
    "participantBId" TEXT NOT NULL,
    "winsA" INTEGER NOT NULL DEFAULT 0,
    "winsB" INTEGER NOT NULL DEFAULT 0,
    "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayoffMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayoffDuel" (
    "id" TEXT NOT NULL,
    "playoffMatchId" TEXT NOT NULL,
    "duelNumber" INTEGER NOT NULL,
    "isSuddenDeath" BOOLEAN NOT NULL DEFAULT false,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayoffDuel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayoffDuelResult" (
    "id" TEXT NOT NULL,
    "duelId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "shots" JSONB,
    "totalRings" DECIMAL(5,1) NOT NULL,
    "teiler" DECIMAL(6,1) NOT NULL,
    "ringteiler" DECIMAL(7,1) NOT NULL,
    "importSource" "ImportSource" NOT NULL DEFAULT 'MANUAL',
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayoffDuelResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "LoginRateLimitBucket_lastAttemptAt_idx" ON "LoginRateLimitBucket"("lastAttemptAt");

-- CreateIndex
CREATE INDEX "LoginRateLimitBucket_blockedUntil_idx" ON "LoginRateLimitBucket"("blockedUntil");

-- CreateIndex
CREATE INDEX "Discipline_isArchived_idx" ON "Discipline"("isArchived");

-- CreateIndex
CREATE INDEX "League_status_idx" ON "League"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_email_key" ON "Participant"("email");

-- CreateIndex
CREATE INDEX "Participant_isActive_idx" ON "Participant"("isActive");

-- CreateIndex
CREATE INDEX "Participant_lastName_idx" ON "Participant"("lastName");

-- CreateIndex
CREATE INDEX "LeagueParticipant_leagueId_idx" ON "LeagueParticipant"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueParticipant_leagueId_participantId_key" ON "LeagueParticipant"("leagueId", "participantId");

-- CreateIndex
CREATE INDEX "Matchup_leagueId_idx" ON "Matchup"("leagueId");

-- CreateIndex
CREATE INDEX "Matchup_leagueId_homeParticipantId_idx" ON "Matchup"("leagueId", "homeParticipantId");

-- CreateIndex
CREATE INDEX "Matchup_leagueId_awayParticipantId_idx" ON "Matchup"("leagueId", "awayParticipantId");

-- CreateIndex
CREATE INDEX "MatchResult_matchupId_idx" ON "MatchResult"("matchupId");

-- CreateIndex
CREATE INDEX "MatchResult_participantId_idx" ON "MatchResult"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchResult_matchupId_participantId_key" ON "MatchResult"("matchupId", "participantId");

-- CreateIndex
CREATE INDEX "PlayoffMatch_leagueId_idx" ON "PlayoffMatch"("leagueId");

-- CreateIndex
CREATE INDEX "PlayoffMatch_leagueId_round_idx" ON "PlayoffMatch"("leagueId", "round");

-- CreateIndex
CREATE INDEX "PlayoffDuel_playoffMatchId_idx" ON "PlayoffDuel"("playoffMatchId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayoffDuel_playoffMatchId_duelNumber_key" ON "PlayoffDuel"("playoffMatchId", "duelNumber");

-- CreateIndex
CREATE INDEX "PlayoffDuelResult_duelId_idx" ON "PlayoffDuelResult"("duelId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayoffDuelResult_duelId_participantId_key" ON "PlayoffDuelResult"("duelId", "participantId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "League" ADD CONSTRAINT "League_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "League" ADD CONSTRAINT "League_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueParticipant" ADD CONSTRAINT "LeagueParticipant_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueParticipant" ADD CONSTRAINT "LeagueParticipant_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matchup" ADD CONSTRAINT "Matchup_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matchup" ADD CONSTRAINT "Matchup_homeParticipantId_fkey" FOREIGN KEY ("homeParticipantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matchup" ADD CONSTRAINT "Matchup_awayParticipantId_fkey" FOREIGN KEY ("awayParticipantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_matchupId_fkey" FOREIGN KEY ("matchupId") REFERENCES "Matchup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffMatch" ADD CONSTRAINT "PlayoffMatch_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffMatch" ADD CONSTRAINT "PlayoffMatch_participantAId_fkey" FOREIGN KEY ("participantAId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffMatch" ADD CONSTRAINT "PlayoffMatch_participantBId_fkey" FOREIGN KEY ("participantBId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffDuel" ADD CONSTRAINT "PlayoffDuel_playoffMatchId_fkey" FOREIGN KEY ("playoffMatchId") REFERENCES "PlayoffMatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffDuelResult" ADD CONSTRAINT "PlayoffDuelResult_duelId_fkey" FOREIGN KEY ("duelId") REFERENCES "PlayoffDuel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffDuelResult" ADD CONSTRAINT "PlayoffDuelResult_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffDuelResult" ADD CONSTRAINT "PlayoffDuelResult_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
