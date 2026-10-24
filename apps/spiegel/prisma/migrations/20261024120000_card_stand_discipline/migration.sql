-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "standDisciplineId" INTEGER;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_standDisciplineId_fkey" FOREIGN KEY ("standDisciplineId") REFERENCES "Discipline"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

