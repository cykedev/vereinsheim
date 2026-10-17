-- AlterTable
ALTER TABLE "Discipline" ADD COLUMN     "confirmedAt" TIMESTAMPTZ(3),
ADD COLUMN     "ignoredAt" TIMESTAMPTZ(3),
ADD COLUMN     "plannedShots" INTEGER,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "disciplineVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Card_disciplineId_idx" ON "Card"("disciplineId");

-- Meytons Spiele und Trainingsscheiben, die schon da sind: ignoriert als Vorschlag, wie beim Einlesen
-- (`suggestIgnore`: 10-m-DisziplinID, Regel 8000 bis 8154, 9001 oder 9002)
UPDATE "Discipline"
   SET "ignoredAt" = CURRENT_TIMESTAMP
 WHERE "meytonId" BETWEEN 10000000 AND 19999999
   AND ((("meytonId" / 1000) % 10000) BETWEEN 8000 AND 8154
        OR (("meytonId" / 1000) % 10000) IN (9001, 9002))
   AND "confirmedAt" IS NULL;
