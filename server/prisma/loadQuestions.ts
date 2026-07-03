import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient, type Difficulty, type QuestionType } from "@prisma/client";

const prisma = new PrismaClient();
const dirname = path.dirname(fileURLToPath(import.meta.url));
const QUESTIONS = path.resolve(dirname, "../../ingestion/data/questions.json");

// Only these sources are ingested as validated: their answers are verified and
// their subject sectioning follows the standard NTA layout. Other parsed
// papers (2019 etc.) are held pending subject-split/agent-cleanup refinement.
const LOAD_SOURCES = new Set(["pyq-2025"]);

interface ParsedQuestion {
  source: string;
  year: number;
  number: number;
  subject: string;
  stem: string;
  options: string[];
  correctIndex: number;
  isDiagram: boolean;
  clean: boolean;
}

function questionType(stem: string): QuestionType {
  if (/match list/i.test(stem)) return "statement_match";
  if (/assertion|statement i\b|statement ii\b|statement - i/i.test(stem)) return "assertion_reason";
  return "mcq";
}

async function main(): Promise<void> {
  if (!fs.existsSync(QUESTIONS)) {
    console.error(`Missing ${QUESTIONS}. Run \`npm run parse:pyq\` in /ingestion first.`);
    process.exit(1);
  }
  const parsed = JSON.parse(fs.readFileSync(QUESTIONS, "utf8")) as ParsedQuestion[];
  const toLoad = parsed.filter((q) => q.clean && LOAD_SOURCES.has(q.source));

  const subjects = await prisma.subject.findMany();
  const byName = new Map(subjects.map((s) => [s.name, s.id]));

  // Idempotent: clear previously-loaded PYQ for these sources, then insert.
  await prisma.question.deleteMany({ where: { source: { in: [...LOAD_SOURCES] } } });

  let inserted = 0;
  for (const q of toLoad) {
    const subjectId = byName.get(q.subject);
    if (!subjectId) continue;
    await prisma.question.create({
      data: {
        subjectId,
        stem: q.stem,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: null, // generated later by the M3 content agent
        difficulty: "medium" satisfies Difficulty, // paper gives no per-question level
        type: questionType(q.stem),
        isDiagram: q.isDiagram,
        source: q.source,
        validated: true, // answer verified against the official key
      },
    });
    inserted++;
  }
  console.log(`Loaded ${inserted} validated PYQ questions (sources: ${[...LOAD_SOURCES].join(", ")}).`);

  const held = parsed.filter((q) => !q.clean || !LOAD_SOURCES.has(q.source)).length;
  console.log(`${held} parsed questions held for future refinement / agent cleanup.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
