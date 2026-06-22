-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'MANAGER';

-- DropIndex
DROP INDEX "cp_unique_individual";

-- DropIndex
DROP INDEX "cp_unique_team";

-- CreateIndex
CREATE INDEX "CompetitionParticipant_competitionId_participantId_idx" ON "CompetitionParticipant"("competitionId", "participantId");
