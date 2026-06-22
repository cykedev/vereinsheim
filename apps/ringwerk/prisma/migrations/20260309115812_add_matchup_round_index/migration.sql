/*
  Warnings:

  - Added the required column `roundIndex` to the `Matchup` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Matchup" ADD COLUMN     "roundIndex" INTEGER NOT NULL;
