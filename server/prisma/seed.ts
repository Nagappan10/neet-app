import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Only the four NEET subjects are seeded here. Chapters/topics are NOT
// hardcoded — per SPEC §5 they are derived from the official NTA 2026 notice
// by the ingestion pipeline (Milestone 2).
const SUBJECTS = ["Physics", "Chemistry", "Botany", "Zoology"];

async function main(): Promise<void> {
  for (const [order, name] of SUBJECTS.entries()) {
    await prisma.subject.upsert({
      where: { name },
      update: { order },
      create: { name, order },
    });
  }
  console.log(`Seeded ${SUBJECTS.length} subjects.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
