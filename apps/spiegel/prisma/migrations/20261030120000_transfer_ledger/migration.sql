-- CreateEnum
CREATE TYPE "TransferItemKind" AS ENUM ('card', 'entry', 'goal', 'routine', 'link', 'printout', 'evidence');

-- CreateTable
CREATE TABLE "TransferRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL,
    "counts" JSONB NOT NULL,

    CONSTRAINT "TransferRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferItem" (
    "userId" TEXT NOT NULL,
    "kind" "TransferItemKind" NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "spiegelId" TEXT NOT NULL,
    "sha256" TEXT,
    "writtenAt" TIMESTAMPTZ(3),
    "revisionId" BIGINT,
    "cardState" TEXT,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TransferItem_pkey" PRIMARY KEY ("userId","kind","sourceKey")
);

-- CreateIndex
CREATE INDEX "TransferRun_userId_at_idx" ON "TransferRun"("userId", "at");

-- AddForeignKey
ALTER TABLE "TransferRun" ADD CONSTRAINT "TransferRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferItem" ADD CONSTRAINT "TransferItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
