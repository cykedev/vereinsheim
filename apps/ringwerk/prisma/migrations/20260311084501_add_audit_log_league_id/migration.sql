-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "leagueId" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_leagueId_idx" ON "AuditLog"("leagueId");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE SET NULL ON UPDATE CASCADE;
