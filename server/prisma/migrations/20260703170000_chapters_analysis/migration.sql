-- DropIndex
DROP INDEX "Chapter_subjectId_className_title_key";

-- AlterTable
ALTER TABLE "Chapter" ADD COLUMN     "analysis" JSONB,
ALTER COLUMN "className" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_subjectId_title_key" ON "Chapter"("subjectId", "title");

