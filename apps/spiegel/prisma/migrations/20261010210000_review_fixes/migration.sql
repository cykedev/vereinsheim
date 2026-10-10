-- DropIndex
DROP INDEX "Card_sourceId_scheibenId_key";

-- DropIndex
DROP INDEX "DeleteLock_userId_sourceId_scheibenId_key";

-- DropIndex
DROP INDEX "Tombstone_sourceId_scheibenId_key";

-- AlterTable
ALTER TABLE "Bridge" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "revokedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Card" DROP COLUMN "official",
ADD COLUMN     "cycle" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastSequence" BIGINT,
ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "CardProjection" ALTER COLUMN "computedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "CardRevision" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "DeleteLock" ADD COLUMN     "cycle" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startedAt" TIMESTAMPTZ(3) NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "NamedPeriod" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Printout" ALTER COLUMN "storedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "RawColumnSet" ALTER COLUMN "columns" SET DATA TYPE JSON;

-- AlterTable
ALTER TABLE "RawRow" ALTER COLUMN "values" SET DATA TYPE JSON,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Site" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Source" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Tombstone" ADD COLUMN     "cycle" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startedAt" TIMESTAMPTZ(3) NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "User" DROP COLUMN "sportpassId",
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- CreateIndex
CREATE UNIQUE INDEX "Card_sourceId_scheibenId_cycle_key" ON "Card"("sourceId", "scheibenId", "cycle");

-- CreateIndex
CREATE INDEX "DeleteLock_sourceId_scheibenId_idx" ON "DeleteLock"("sourceId", "scheibenId");

-- CreateIndex
CREATE UNIQUE INDEX "DeleteLock_userId_sourceId_scheibenId_cycle_key" ON "DeleteLock"("userId", "sourceId", "scheibenId", "cycle");

-- CreateIndex
CREATE INDEX "Printout_footerId_idx" ON "Printout"("footerId");

-- CreateIndex
CREATE UNIQUE INDEX "Tombstone_sourceId_scheibenId_cycle_key" ON "Tombstone"("sourceId", "scheibenId", "cycle");

