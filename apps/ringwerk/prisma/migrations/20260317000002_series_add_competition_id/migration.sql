-- AlterTable: Series bekommt optionale competitionId für EVENT/SAISON-Serien
-- Liga-Serien bleiben NULL (Zuordnung via matchupId).
ALTER TABLE "Series" ADD COLUMN "competitionId" TEXT;

-- FK-Constraint
ALTER TABLE "Series" ADD CONSTRAINT "Series_competitionId_fkey"
  FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Index für Event/Saison-Abfragen
CREATE INDEX "Series_competitionId_idx" ON "Series"("competitionId");
