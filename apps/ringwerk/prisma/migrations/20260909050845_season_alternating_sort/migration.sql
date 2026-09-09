-- CreateEnum
CREATE TYPE "SeasonSortMode" AS ENUM ('ALT_RINGS_FIRST', 'ALT_TEILER_FIRST');

-- AlterTable
ALTER TABLE "Competition" ADD COLUMN     "seasonSortMode" "SeasonSortMode";
