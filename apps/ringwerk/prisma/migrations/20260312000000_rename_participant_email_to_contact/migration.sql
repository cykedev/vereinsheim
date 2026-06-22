-- Rename column: Participant.email → Participant.contact
-- Preserves all existing data (no drop/recreate)
ALTER TABLE "Participant" RENAME COLUMN "email" TO "contact";
