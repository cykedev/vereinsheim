-- Add isGuestRecord flag to Participant
-- Stille Datensätze für Gast-Schützen (nicht in der Teilnehmerverwaltung sichtbar)
ALTER TABLE "Participant" ADD COLUMN IF NOT EXISTS "isGuestRecord" BOOLEAN NOT NULL DEFAULT false;
