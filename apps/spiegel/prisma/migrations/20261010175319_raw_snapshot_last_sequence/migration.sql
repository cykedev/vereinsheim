/*
  Warnings:

  - Added the required column `lastObservedAt` to the `RawSnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastSequence` to the `RawSnapshot` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "RawSnapshot" ADD COLUMN     "lastObservedAt" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "lastSequence" BIGINT NOT NULL;
