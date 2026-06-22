-- Add TARGET_OVER value to ScoringMode enum
DO $$ BEGIN
  ALTER TYPE "ScoringMode" ADD VALUE IF NOT EXISTS 'TARGET_OVER';
EXCEPTION WHEN duplicate_object THEN null;
END $$;
