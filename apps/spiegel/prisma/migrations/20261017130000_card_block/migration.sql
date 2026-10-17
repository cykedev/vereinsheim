-- DropIndex
DROP INDEX "Card_sourceId_scheibenId_cycle_key";

-- AlterTable
ALTER TABLE "RawSnapshot" ADD COLUMN     "block" INTEGER;

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "block" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Card_sourceId_scheibenId_cycle_block_key" ON "Card"("sourceId", "scheibenId", "cycle", "block");

