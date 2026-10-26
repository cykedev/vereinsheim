-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CardOrigin" ADD VALUE 'manual';
ALTER TYPE "CardOrigin" ADD VALUE 'treffsicher';

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "importKey" TEXT,
ADD COLUMN     "place" TEXT;

-- AlterTable
ALTER TABLE "CardProjection" ADD COLUMN     "detail" JSONB;

-- AlterTable
ALTER TABLE "CardRevision" ADD COLUMN     "centerShots" INTEGER,
ADD COLUMN     "centerXUm" INTEGER,
ADD COLUMN     "centerYUm" INTEGER,
ADD COLUMN     "totalDecimalTenths" INTEGER,
ADD COLUMN     "totalRings" INTEGER,
ADD COLUMN     "totalShots" INTEGER;

-- AlterTable
ALTER TABLE "Discipline" ADD COLUMN     "seriesShots" INTEGER,
ALTER COLUMN "meytonId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Shot" ALTER COLUMN "innerTen" DROP NOT NULL;

-- CreateTable
CREATE TABLE "SeriesSum" (
    "id" BIGSERIAL NOT NULL,
    "revisionId" BIGINT NOT NULL,
    "series" INTEGER NOT NULL,
    "shots" INTEGER NOT NULL,
    "rings" INTEGER,
    "decimalTenths" INTEGER,

    CONSTRAINT "SeriesSum_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeriesSum_revisionId_series_key" ON "SeriesSum"("revisionId", "series");

-- CreateIndex
CREATE UNIQUE INDEX "Card_importKey_key" ON "Card"("importKey");

-- AddForeignKey
ALTER TABLE "SeriesSum" ADD CONSTRAINT "SeriesSum_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "CardRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Angaben ohne Einzelschüsse: Prisma kennt keine CHECKs, sie halten nur die Datenbank sauber
ALTER TABLE "SeriesSum" ADD CONSTRAINT "SeriesSum_value_check" CHECK ("rings" IS NOT NULL OR "decimalTenths" IS NOT NULL);
ALTER TABLE "SeriesSum" ADD CONSTRAINT "SeriesSum_count_check" CHECK ("series" > 0 AND "shots" > 0);
ALTER TABLE "CardRevision" ADD CONSTRAINT "CardRevision_total_check" CHECK (
  (("totalRings" IS NULL AND "totalDecimalTenths" IS NULL) = ("totalShots" IS NULL)) AND ("totalShots" IS NULL OR "totalShots" > 0));
ALTER TABLE "CardRevision" ADD CONSTRAINT "CardRevision_center_check" CHECK (
  ("centerXUm" IS NULL) = ("centerYUm" IS NULL) AND ("centerXUm" IS NULL) = ("centerShots" IS NULL) AND ("centerShots" IS NULL OR "centerShots" > 0));
