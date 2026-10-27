-- AlterEnum
ALTER TYPE "CardRequestStatus" ADD VALUE 'printMismatch';

-- CreateIndex
CREATE INDEX "CardRequest_cardId_idx" ON "CardRequest"("cardId");

