-- AlterTable
ALTER TABLE "Competition" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicPasswordHash" TEXT,
ADD COLUMN     "publicSlug" TEXT;
