-- CreateEnum
CREATE TYPE "CardRequestStatus" AS ENUM ('open', 'done', 'missing', 'held', 'mismatch', 'taken', 'withdrawn');

-- CreateTable
CREATE TABLE "CardRequest" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "siteId" INTEGER NOT NULL,
    "scheibenId" INTEGER NOT NULL,
    "day" TEXT NOT NULL,
    "status" "CardRequestStatus" NOT NULL DEFAULT 'open',
    "cardId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMPTZ(3),

    CONSTRAINT "CardRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardRequest_siteId_status_scheibenId_idx" ON "CardRequest"("siteId", "status", "scheibenId");

-- CreateIndex
CREATE INDEX "CardRequest_userId_createdAt_idx" ON "CardRequest"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CardRequest" ADD CONSTRAINT "CardRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardRequest" ADD CONSTRAINT "CardRequest_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardRequest" ADD CONSTRAINT "CardRequest_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

