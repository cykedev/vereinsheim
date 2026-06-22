-- CreateEnum
CREATE TYPE "CompetitionType" AS ENUM ('LEAGUE', 'EVENT', 'SEASON');

-- CreateEnum
CREATE TYPE "ScoringMode" AS ENUM ('RINGTEILER', 'RINGS', 'RINGS_DECIMAL', 'TEILER', 'DECIMAL_REST', 'TARGET_ABSOLUTE', 'TARGET_UNDER');

-- CreateEnum
CREATE TYPE "TargetValueType" AS ENUM ('TEILER', 'RINGS', 'RINGS_DECIMAL');

-- AlterTable
ALTER TABLE "Discipline" ADD COLUMN     "teilerFaktor" DECIMAL(4,3) NOT NULL DEFAULT 1.0;

-- RenameIndex
ALTER INDEX "Participant_email_key" RENAME TO "Participant_contact_key";
