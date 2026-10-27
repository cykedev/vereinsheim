-- AlterTable
ALTER TABLE "CardRequest" ADD COLUMN     "windowAt" TIMESTAMPTZ(3);

-- Backfill: open requests keep their deadline of 30 days from creation
UPDATE "CardRequest" SET "windowAt" = "createdAt" WHERE "status" = 'open';
