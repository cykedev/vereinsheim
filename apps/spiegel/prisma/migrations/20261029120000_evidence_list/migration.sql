-- DropIndex
DROP INDEX "CardEvidence_cardId_key";

-- AlterTable
ALTER TABLE "CardEvidence" ADD COLUMN     "fileName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CardEvidence_cardId_sha256_key" ON "CardEvidence"("cardId", "sha256");

