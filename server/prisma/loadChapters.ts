import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dirname = path.dirname(fileURLToPath(import.meta.url));
const CHAPTERS = path.resolve(dirname, "../../ingestion/data/chapters.json");

interface ParsedChapter {
  subject: string;
  order: number;
  title: string;
  weighting: number;
  topics: string[];
  analysis: unknown;
}

async function main(): Promise<void> {
  if (!fs.existsSync(CHAPTERS)) {
    console.error(
      `Missing ${CHAPTERS}. Run \`npm run parse:analysis\` in /ingestion first.`,
    );
    process.exit(1);
  }
  const chapters = JSON.parse(fs.readFileSync(CHAPTERS, "utf8")) as ParsedChapter[];

  const subjects = await prisma.subject.findMany();
  const byName = new Map(subjects.map((s) => [s.name, s.id]));

  let upserted = 0;
  for (const ch of chapters) {
    const subjectId = byName.get(ch.subject);
    if (!subjectId) {
      console.warn(`Skipping "${ch.title}" — unknown subject ${ch.subject}`);
      continue;
    }
    await prisma.chapter.upsert({
      where: { subjectId_title: { subjectId, title: ch.title } },
      update: {
        order: ch.order,
        weighting: ch.weighting,
        topics: ch.topics,
        analysis: ch.analysis as object,
      },
      create: {
        subjectId,
        title: ch.title,
        order: ch.order,
        weighting: ch.weighting,
        topics: ch.topics,
        analysis: ch.analysis as object,
        ntaIncluded: true,
      },
    });
    upserted++;
  }
  console.log(`Loaded ${upserted} chapters into the database.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
