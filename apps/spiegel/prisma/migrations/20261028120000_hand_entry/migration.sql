-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "timeUnknown" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CardEvidence" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CardEvidence_cardId_key" ON "CardEvidence"("cardId");

-- CreateIndex
CREATE INDEX "CardEvidence_sha256_idx" ON "CardEvidence"("sha256");

-- AddForeignKey
ALTER TABLE "CardEvidence" ADD CONSTRAINT "CardEvidence_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

