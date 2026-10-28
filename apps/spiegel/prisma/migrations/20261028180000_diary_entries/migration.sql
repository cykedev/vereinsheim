-- CreateEnum
CREATE TYPE "DiaryKind" AS ENUM ('shooting', 'dry', 'mental');

-- CreateEnum
CREATE TYPE "DiaryOutcome" AS ENUM ('yes', 'partly', 'no');

-- CreateEnum
CREATE TYPE "DiaryScalePart" AS ENUM ('wellbeing', 'prognosis', 'feedback');

-- CreateEnum
CREATE TYPE "DiaryCardLink" AS ENUM ('linked', 'released');

-- CreateTable
CREATE TABLE "DiarySettings" (
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "noticeSeenAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DiarySettings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "DiaryEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "kind" "DiaryKind" NOT NULL DEFAULT 'shooting',
    "familyId" INTEGER,
    "intention" TEXT,
    "note" TEXT,
    "outcome" "DiaryOutcome",
    "learned" TEXT,
    "question" TEXT,
    "disturbed" TEXT,
    "expectedScore" DECIMAL(5,1),
    "importKey" TEXT,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DiaryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiaryEntryCard" (
    "cardId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "link" "DiaryCardLink" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DiaryEntryCard_pkey" PRIMARY KEY ("cardId")
);

-- CreateTable
CREATE TABLE "DiaryScale" (
    "entryId" TEXT NOT NULL,
    "part" "DiaryScalePart" NOT NULL,
    "aspect" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "DiaryScale_pkey" PRIMARY KEY ("entryId","part","aspect")
);

-- CreateTable
CREATE TABLE "DiarySeriesExecution" (
    "entryId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "series" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "DiarySeriesExecution_pkey" PRIMARY KEY ("entryId","cardId","series")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiaryEntry_importKey_key" ON "DiaryEntry"("importKey");

-- CreateIndex
CREATE INDEX "DiaryEntry_userId_day_idx" ON "DiaryEntry"("userId", "day");

-- CreateIndex
CREATE INDEX "DiaryEntry_userId_familyId_day_idx" ON "DiaryEntry"("userId", "familyId", "day");

-- CreateIndex
CREATE INDEX "DiaryEntryCard_entryId_idx" ON "DiaryEntryCard"("entryId");

-- AddForeignKey
ALTER TABLE "DiarySettings" ADD CONSTRAINT "DiarySettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryEntryCard" ADD CONSTRAINT "DiaryEntryCard_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "DiaryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryScale" ADD CONSTRAINT "DiaryScale_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "DiaryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiarySeriesExecution" ADD CONSTRAINT "DiarySeriesExecution_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "DiaryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

