-- CreateEnum
CREATE TYPE "Scoring" AS ENUM ('decimal', 'rings');

-- CreateEnum
CREATE TYPE "CardKind" AS ENUM ('training', 'competition');

-- CreateEnum
CREATE TYPE "CardState" AS ENUM ('open', 'resting', 'final');

-- CreateEnum
CREATE TYPE "CardOrigin" AS ENUM ('raw', 'pdf');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateTable
CREATE TABLE "Site" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "consentSalt" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" SERIAL NOT NULL,
    "siteId" INTEGER NOT NULL,
    "epoch" INTEGER NOT NULL,
    "confirmedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bridge" (
    "id" SERIAL NOT NULL,
    "siteId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "version" TEXT,
    "lastSeenAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),
    "runStartedAt" TIMESTAMPTZ(3),
    "lastHeartbeatAt" TIMESTAMPTZ(3),
    "heartbeat" JSONB,

    CONSTRAINT "Bridge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BridgePairing" (
    "id" SERIAL NOT NULL,
    "siteId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "bridgeId" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BridgePairing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClockReading" (
    "id" SERIAL NOT NULL,
    "siteId" INTEGER NOT NULL,
    "measuredAt" TIMESTAMPTZ(3) NOT NULL,
    "offsetMs" INTEGER NOT NULL,

    CONSTRAINT "ClockReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SportpassConsent" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "siteId" INTEGER NOT NULL,
    "sportpassId" BIGINT NOT NULL,
    "consentedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consentVersion" TEXT NOT NULL DEFAULT 'v1',
    "confirmedAt" TIMESTAMPTZ(3),
    "rejectedAt" TIMESTAMPTZ(3),
    "returnedAt" TIMESTAMPTZ(3),
    "firstCardConfirmedAt" TIMESTAMPTZ(3),
    "historyLoadedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SportpassConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawRow" (
    "id" BIGSERIAL NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "scheibenId" INTEGER NOT NULL,
    "table" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "values" JSON NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawColumnSet" (
    "id" SERIAL NOT NULL,
    "checksum" TEXT NOT NULL,
    "columns" JSON NOT NULL,

    CONSTRAINT "RawColumnSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawSnapshot" (
    "id" BIGSERIAL NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "scheibenId" INTEGER NOT NULL,
    "sequence" BIGINT NOT NULL,
    "lastSequence" BIGINT NOT NULL,
    "lastObservedAt" TIMESTAMPTZ(3) NOT NULL,
    "bridgeId" INTEGER,
    "contractVersion" INTEGER NOT NULL,
    "sourceVersion" TEXT,
    "sessionTimeZone" TEXT NOT NULL,
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checksum" TEXT NOT NULL,
    "columnSetId" INTEGER NOT NULL,
    "scheibenRowIds" BIGINT[],
    "serienRowIds" BIGINT[],
    "trefferRowIds" BIGINT[],
    "contentChecksum" TEXT,
    "lifesign" TEXT,
    "lifesignAt" TIMESTAMPTZ(3),
    "adapterVersion" TEXT,
    "quarantine" TEXT,

    CONSTRAINT "RawSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tombstone" (
    "id" SERIAL NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "scheibenId" INTEGER NOT NULL,
    "cycle" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "userId" TEXT,
    "sportpassId" BIGINT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tombstone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeleteLock" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "scheibenId" INTEGER NOT NULL,
    "cycle" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeleteLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NamedPeriod" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "from" DATE NOT NULL,
    "to" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NamedPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginRateLimitBucket" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "windowStartedAt" TIMESTAMPTZ(3) NOT NULL,
    "blockedUntil" TIMESTAMPTZ(3),
    "lastAttemptAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LoginRateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyScoring" (
    "userId" TEXT NOT NULL,
    "familyId" INTEGER NOT NULL,
    "scoring" "Scoring" NOT NULL,

    CONSTRAINT "FamilyScoring_pkey" PRIMARY KEY ("userId","familyId")
);

-- CreateTable
CREATE TABLE "Discipline" (
    "id" SERIAL NOT NULL,
    "siteId" INTEGER NOT NULL,
    "meytonId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "familyId" INTEGER,
    "targetId" TEXT,
    "officialScoring" "Scoring",

    CONSTRAINT "Discipline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ranking" (
    "id" SERIAL NOT NULL,
    "siteId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CardKind",

    CONSTRAINT "Ranking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "sourceId" INTEGER,
    "scheibenId" INTEGER,
    "cycle" INTEGER NOT NULL DEFAULT 0,
    "lastSequence" BIGINT,
    "ownerId" TEXT,
    "ownerPending" BOOLEAN NOT NULL DEFAULT false,
    "sportpassId" BIGINT,
    "disciplineId" INTEGER NOT NULL,
    "familyId" INTEGER,
    "stand" TEXT,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "endedAt" TIMESTAMPTZ(3),
    "kind" "CardKind" NOT NULL,
    "kindChoice" "CardKind",
    "rankingId" INTEGER,
    "state" "CardState" NOT NULL,
    "complete" BOOLEAN NOT NULL,
    "standScoring" "Scoring",
    "scoringChoice" "Scoring",
    "flags" TEXT[],
    "origin" "CardOrigin" NOT NULL,
    "currentRevisionId" BIGINT,
    "deletedAt" TIMESTAMPTZ(3),
    "lifesignAt" TIMESTAMPTZ(3),
    "clockOffsetMs" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardRevision" (
    "id" BIGSERIAL NOT NULL,
    "cardId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "rawSnapshotId" BIGINT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shot" (
    "id" BIGSERIAL NOT NULL,
    "revisionId" BIGINT NOT NULL,
    "cardId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "stellung" INTEGER NOT NULL,
    "treffer" INTEGER NOT NULL,
    "series" INTEGER,
    "xUm" INTEGER,
    "yUm" INTEGER,
    "ring" INTEGER,
    "decimalTenths" INTEGER,
    "distanceTenthsUm" INTEGER,
    "innerTen" BOOLEAN NOT NULL,
    "displayMode" INTEGER,
    "firedAt" TIMESTAMPTZ(3),
    "flags" TEXT[],
    "fingerprint" TEXT NOT NULL,

    CONSTRAINT "Shot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardProjection" (
    "cardId" TEXT NOT NULL,
    "revisionId" BIGINT NOT NULL,
    "version" TEXT NOT NULL,
    "probeOnly" BOOLEAN NOT NULL,
    "suspicious" BOOLEAN NOT NULL,
    "printedShots" INTEGER NOT NULL,
    "values" JSONB NOT NULL,
    "records" JSONB NOT NULL,
    "marks" JSONB NOT NULL,
    "computedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardProjection_pkey" PRIMARY KEY ("cardId")
);

-- CreateTable
CREATE TABLE "Printout" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "footerId" TEXT,
    "printedAt" TIMESTAMPTZ(3),
    "storedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Printout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Source_siteId_epoch_key" ON "Source"("siteId", "epoch");

-- CreateIndex
CREATE UNIQUE INDEX "Bridge_tokenHash_key" ON "Bridge"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "BridgePairing_codeHash_key" ON "BridgePairing"("codeHash");

-- CreateIndex
CREATE INDEX "ClockReading_siteId_measuredAt_idx" ON "ClockReading"("siteId", "measuredAt");

-- CreateIndex
CREATE INDEX "SportpassConsent_userId_idx" ON "SportpassConsent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SportpassConsent_siteId_sportpassId_key" ON "SportpassConsent"("siteId", "sportpassId");

-- CreateIndex
CREATE UNIQUE INDEX "RawRow_sourceId_scheibenId_table_checksum_key" ON "RawRow"("sourceId", "scheibenId", "table", "checksum");

-- CreateIndex
CREATE UNIQUE INDEX "RawColumnSet_checksum_key" ON "RawColumnSet"("checksum");

-- CreateIndex
CREATE INDEX "RawSnapshot_sourceId_lastObservedAt_idx" ON "RawSnapshot"("sourceId", "lastObservedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RawSnapshot_sourceId_scheibenId_sequence_key" ON "RawSnapshot"("sourceId", "scheibenId", "sequence");

-- CreateIndex
CREATE INDEX "Tombstone_userId_idx" ON "Tombstone"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Tombstone_sourceId_scheibenId_cycle_key" ON "Tombstone"("sourceId", "scheibenId", "cycle");

-- CreateIndex
CREATE INDEX "DeleteLock_sourceId_scheibenId_idx" ON "DeleteLock"("sourceId", "scheibenId");

-- CreateIndex
CREATE UNIQUE INDEX "DeleteLock_userId_sourceId_scheibenId_cycle_key" ON "DeleteLock"("userId", "sourceId", "scheibenId", "cycle");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "NamedPeriod_ownerId_idx" ON "NamedPeriod"("ownerId");

-- CreateIndex
CREATE INDEX "LoginRateLimitBucket_lastAttemptAt_idx" ON "LoginRateLimitBucket"("lastAttemptAt");

-- CreateIndex
CREATE INDEX "LoginRateLimitBucket_blockedUntil_idx" ON "LoginRateLimitBucket"("blockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "Family_slug_key" ON "Family"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Discipline_siteId_meytonId_name_key" ON "Discipline"("siteId", "meytonId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Ranking_siteId_name_key" ON "Ranking"("siteId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Card_currentRevisionId_key" ON "Card"("currentRevisionId");

-- CreateIndex
CREATE INDEX "Card_ownerId_familyId_startedAt_idx" ON "Card"("ownerId", "familyId", "startedAt");

-- CreateIndex
CREATE INDEX "Card_ownerId_startedAt_idx" ON "Card"("ownerId", "startedAt");

-- CreateIndex
CREATE INDEX "Card_sourceId_state_idx" ON "Card"("sourceId", "state");

-- CreateIndex
CREATE INDEX "Card_rankingId_idx" ON "Card"("rankingId");

-- CreateIndex
CREATE INDEX "Card_sportpassId_idx" ON "Card"("sportpassId");

-- CreateIndex
CREATE UNIQUE INDEX "Card_sourceId_scheibenId_cycle_key" ON "Card"("sourceId", "scheibenId", "cycle");

-- CreateIndex
CREATE UNIQUE INDEX "CardRevision_cardId_number_key" ON "CardRevision"("cardId", "number");

-- CreateIndex
CREATE INDEX "Shot_cardId_fingerprint_idx" ON "Shot"("cardId", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "Shot_revisionId_stellung_treffer_key" ON "Shot"("revisionId", "stellung", "treffer");

-- CreateIndex
CREATE INDEX "CardProjection_version_idx" ON "CardProjection"("version");

-- CreateIndex
CREATE INDEX "Printout_footerId_idx" ON "Printout"("footerId");

-- CreateIndex
CREATE UNIQUE INDEX "Printout_cardId_sha256_key" ON "Printout"("cardId", "sha256");

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bridge" ADD CONSTRAINT "Bridge_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BridgePairing" ADD CONSTRAINT "BridgePairing_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BridgePairing" ADD CONSTRAINT "BridgePairing_bridgeId_fkey" FOREIGN KEY ("bridgeId") REFERENCES "Bridge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClockReading" ADD CONSTRAINT "ClockReading_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SportpassConsent" ADD CONSTRAINT "SportpassConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SportpassConsent" ADD CONSTRAINT "SportpassConsent_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawRow" ADD CONSTRAINT "RawRow_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawSnapshot" ADD CONSTRAINT "RawSnapshot_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawSnapshot" ADD CONSTRAINT "RawSnapshot_bridgeId_fkey" FOREIGN KEY ("bridgeId") REFERENCES "Bridge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawSnapshot" ADD CONSTRAINT "RawSnapshot_columnSetId_fkey" FOREIGN KEY ("columnSetId") REFERENCES "RawColumnSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tombstone" ADD CONSTRAINT "Tombstone_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tombstone" ADD CONSTRAINT "Tombstone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeleteLock" ADD CONSTRAINT "DeleteLock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeleteLock" ADD CONSTRAINT "DeleteLock_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NamedPeriod" ADD CONSTRAINT "NamedPeriod_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyScoring" ADD CONSTRAINT "FamilyScoring_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyScoring" ADD CONSTRAINT "FamilyScoring_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discipline" ADD CONSTRAINT "Discipline_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discipline" ADD CONSTRAINT "Discipline_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ranking" ADD CONSTRAINT "Ranking_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_rankingId_fkey" FOREIGN KEY ("rankingId") REFERENCES "Ranking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "CardRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardRevision" ADD CONSTRAINT "CardRevision_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardRevision" ADD CONSTRAINT "CardRevision_rawSnapshotId_fkey" FOREIGN KEY ("rawSnapshotId") REFERENCES "RawSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shot" ADD CONSTRAINT "Shot_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "CardRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shot" ADD CONSTRAINT "Shot_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardProjection" ADD CONSTRAINT "CardProjection_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Printout" ADD CONSTRAINT "Printout_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

