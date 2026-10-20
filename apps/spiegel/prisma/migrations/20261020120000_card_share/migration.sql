-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "shareId" UUID,
ADD COLUMN     "sharedAt" TIMESTAMPTZ(3);

-- CreateIndex
CREATE UNIQUE INDEX "Card_shareId_key" ON "Card"("shareId");

