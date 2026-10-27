-- CreateEnum
CREATE TYPE "PrintoutValuesStatus" AS ENUM ('ok', 'empty', 'inconsistent', 'unreadable');

-- AlterTable
ALTER TABLE "Printout" ADD COLUMN     "layout" TEXT,
ADD COLUMN     "readerVersion" TEXT,
ADD COLUMN     "reading" JSONB,
ADD COLUMN     "valuesStatus" "PrintoutValuesStatus";

