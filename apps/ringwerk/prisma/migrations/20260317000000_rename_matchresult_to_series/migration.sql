-- Phase 3: MatchResult → Series
-- Rename table, rename column totalRings → rings, add new columns with backfill.
-- Manual migration (Prisma would drop+recreate; we use ALTER TABLE for safety).

-- Step 1: Rename the table
ALTER TABLE "MatchResult" RENAME TO "Series";

-- Step 2: Rename column totalRings → rings
ALTER TABLE "Series" RENAME COLUMN "totalRings" TO "rings";

-- Step 3: Make matchupId nullable (Liga still uses it; Event/Season won't)
ALTER TABLE "Series" ALTER COLUMN "matchupId" DROP NOT NULL;

-- Step 4: Add new columns as nullable first (backfill required before NOT NULL)
ALTER TABLE "Series" ADD COLUMN "disciplineId" TEXT;
ALTER TABLE "Series" ADD COLUMN "shotCount" INTEGER;
ALTER TABLE "Series" ADD COLUMN "sessionDate" TIMESTAMP(3);

-- Step 5: Backfill disciplineId from Competition via Matchup
UPDATE "Series" s
SET "disciplineId" = (
  SELECT c."disciplineId"
  FROM "Matchup" m
  JOIN "Competition" c ON c.id = m."competitionId"
  WHERE m.id = s."matchupId"
    AND c."disciplineId" IS NOT NULL
);

-- Step 6: Backfill shotCount from Competition.shotsPerSeries via Matchup
UPDATE "Series" s
SET "shotCount" = COALESCE((
  SELECT c."shotsPerSeries"
  FROM "Matchup" m
  JOIN "Competition" c ON c.id = m."competitionId"
  WHERE m.id = s."matchupId"
), 10);

-- Step 7: Backfill sessionDate from Matchup.dueDate, fallback to createdAt
UPDATE "Series" s
SET "sessionDate" = COALESCE((
  SELECT m."dueDate"
  FROM "Matchup" m
  WHERE m.id = s."matchupId"
), s."createdAt");

-- Step 8: Apply NOT NULL after backfill
ALTER TABLE "Series" ALTER COLUMN "disciplineId" SET NOT NULL;
ALTER TABLE "Series" ALTER COLUMN "shotCount" SET NOT NULL;
ALTER TABLE "Series" ALTER COLUMN "sessionDate" SET NOT NULL;

-- Step 9: Add FK constraint for disciplineId
ALTER TABLE "Series" ADD CONSTRAINT "Series_disciplineId_fkey"
  FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 10: Rename primary key constraint
ALTER TABLE "Series" RENAME CONSTRAINT "MatchResult_pkey" TO "Series_pkey";

-- Step 11: Rename FK constraints (created via ADD CONSTRAINT in init migration)
ALTER TABLE "Series" RENAME CONSTRAINT "MatchResult_matchupId_fkey" TO "Series_matchupId_fkey";
ALTER TABLE "Series" RENAME CONSTRAINT "MatchResult_participantId_fkey" TO "Series_participantId_fkey";
ALTER TABLE "Series" RENAME CONSTRAINT "MatchResult_recordedByUserId_fkey" TO "Series_recordedByUserId_fkey";

-- Step 12: Rename indexes (created via CREATE INDEX — use ALTER INDEX, not RENAME CONSTRAINT)
ALTER INDEX "MatchResult_matchupId_idx" RENAME TO "Series_matchupId_idx";
ALTER INDEX "MatchResult_participantId_idx" RENAME TO "Series_participantId_idx";
ALTER INDEX "MatchResult_matchupId_participantId_key" RENAME TO "Series_matchupId_participantId_key";

-- Step 13: Add index for new FK
CREATE INDEX "Series_disciplineId_idx" ON "Series"("disciplineId");
