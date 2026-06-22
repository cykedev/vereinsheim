-- Make contact field optional (nullable) on Participant
ALTER TABLE "Participant" ALTER COLUMN "contact" DROP NOT NULL;
