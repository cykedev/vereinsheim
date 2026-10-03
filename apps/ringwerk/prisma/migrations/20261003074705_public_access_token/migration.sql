-- AlterTable
ALTER TABLE "Competition" ADD COLUMN     "publicAccessToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Competition_publicAccessToken_key" ON "Competition"("publicAccessToken");

