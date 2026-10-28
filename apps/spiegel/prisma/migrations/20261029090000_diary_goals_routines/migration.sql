-- CreateEnum
CREATE TYPE "DiaryGoalKind" AS ENUM ('result', 'process');

-- CreateEnum
CREATE TYPE "DiaryGoalMeasure" AS ENUM ('card', 'series', 'average');

-- CreateEnum
CREATE TYPE "DiaryGoalCards" AS ENUM ('all', 'training', 'competition');

-- CreateEnum
CREATE TYPE "DiaryGoalScoring" AS ENUM ('rings', 'decimal');

-- AlterTable
ALTER TABLE "CardProjection" ADD COLUMN     "series" JSONB;

-- CreateTable
CREATE TABLE "DiaryGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" INTEGER,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "kind" "DiaryGoalKind" NOT NULL,
    "from" DATE NOT NULL,
    "to" DATE NOT NULL,
    "measure" "DiaryGoalMeasure",
    "threshold" DECIMAL(6,1),
    "scoring" "DiaryGoalScoring",
    "shots" INTEGER,
    "cards" "DiaryGoalCards" NOT NULL DEFAULT 'all',
    "outcome" "DiaryOutcome",
    "importKey" TEXT,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DiaryGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiaryRoutine" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" INTEGER,
    "name" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "importKey" TEXT,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DiaryRoutine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiaryGoal_importKey_key" ON "DiaryGoal"("importKey");

-- CreateIndex
CREATE INDEX "DiaryGoal_userId_to_idx" ON "DiaryGoal"("userId", "to");

-- CreateIndex
CREATE UNIQUE INDEX "DiaryRoutine_importKey_key" ON "DiaryRoutine"("importKey");

-- CreateIndex
CREATE INDEX "DiaryRoutine_userId_familyId_idx" ON "DiaryRoutine"("userId", "familyId");

-- AddForeignKey
ALTER TABLE "DiaryGoal" ADD CONSTRAINT "DiaryGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryRoutine" ADD CONSTRAINT "DiaryRoutine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

