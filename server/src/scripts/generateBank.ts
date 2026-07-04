import { PrismaClient, type Chapter } from "@prisma/client";
import { generateQuestions } from "../agent/questions.js";
import { getProvider, MissingApiKeyError } from "../agent/provider.js";
import type { GeneratedQuestion, GenerateOptions, Provider } from "../agent/types.js";

/**
 * Batch pre-generation (SPEC §8/M8): fill every NTA-2026 chapter up to a target
 * number of validated questions so tests feel like the real exam (45+/chapter).
 *
 * - Resumable: counts what each chapter already has and only tops up the gap.
 * - Rate-limited: paces provider calls to survive free-tier RPM limits, with
 *   exponential backoff on 429/5xx.
 * - Prioritized: chapters processed by exam weighting (most-tested first).
 * - Quality: reuses the agent's two-stage validation; near-duplicate stems are
 *   skipped so re-runs don't pad the bank with repeats.
 *
 * Usage (from /server):
 *   npm run generate:bank -- --target 45 --rpm 12 --batch 8
 *   npm run generate:bank -- --subject Physics --max 200
 *   npm run generate:bank -- --chapter <chapterId>
 */

const prisma = new PrismaClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Paces + retries a provider so batch runs don't trip rate limits. */
class PacedProvider implements Provider {
  readonly name: string;
  readonly model: string;
  private last = 0;
  constructor(
    private readonly inner: Provider,
    private readonly minIntervalMs: number,
  ) {
    this.name = inner.name;
    this.model = inner.model;
  }
  async generate(opts: GenerateOptions): Promise<string> {
    for (let attempt = 0; ; attempt++) {
      const wait = this.minIntervalMs - (Date.now() - this.last);
      if (wait > 0) await sleep(wait);
      this.last = Date.now();
      try {
        return await this.inner.generate(opts);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const retriable = /\b429\b|\b5\d\d\b|quota|rate|overload|timeout/i.test(msg);
        if (retriable && attempt < 5) {
          const backoff = Math.min(60_000, 2000 * 2 ** attempt);
          console.warn(`   ↻ retry in ${backoff}ms (${msg.slice(0, 80)})`);
          await sleep(backoff);
          continue;
        }
        throw err;
      }
    }
  }
}

export interface FillOptions {
  target: number;
  batch: number;
  maxAdd?: number; // cap questions added this call (for --max budgeting)
  onSaved?: (total: number) => void;
}

export interface FillResult {
  existing: number;
  added: number;
  target: number;
}

/** Top a single chapter up to `target` validated questions. */
export async function fillChapter(
  db: PrismaClient,
  provider: Provider,
  chapter: Chapter & { subject: { name: string } },
  opts: FillOptions,
): Promise<FillResult> {
  const existing = await db.questionChapter.count({
    where: { chapterId: chapter.id, question: { validated: true } },
  });

  // Seed the dedup set with existing stems for this chapter.
  const priorStems = await db.question.findMany({
    where: { chapters: { some: { chapterId: chapter.id } } },
    select: { stem: true },
  });
  const seen = new Set(priorStems.map((q) => norm(q.stem)));

  let have = existing;
  let added = 0;
  let stagnantRounds = 0;

  while (have < opts.target) {
    if (opts.maxAdd !== undefined && added >= opts.maxAdd) break;
    const need = Math.min(opts.batch, opts.target - have);

    const result = await generateQuestions(provider, {
      subject: chapter.subject.name,
      chapterTitle: chapter.title,
      topics: chapter.topics,
      count: need,
      difficulty: "mixed",
    });

    const fresh = result.questions.filter((q) => !seen.has(norm(q.stem)));
    if (fresh.length === 0) {
      // Nothing usable this round (all rejected or duplicates) — bail after 3.
      if (++stagnantRounds >= 3) break;
      continue;
    }
    stagnantRounds = 0;

    for (const q of fresh) {
      if (opts.maxAdd !== undefined && added >= opts.maxAdd) break;
      await saveQuestion(db, chapter, q);
      seen.add(norm(q.stem));
      have++;
      added++;
      opts.onSaved?.(added);
    }
  }

  return { existing, added, target: opts.target };
}

async function saveQuestion(
  db: PrismaClient,
  chapter: { id: string; subjectId: string },
  q: GeneratedQuestion,
): Promise<void> {
  await db.question.create({
    data: {
      subjectId: chapter.subjectId,
      stem: q.stem,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      difficulty: q.difficulty,
      type: "mcq",
      isDiagram: false,
      source: "ai-generated",
      validated: true,
      chapters: { create: [{ chapterId: chapter.id }] },
    },
  });
}

interface Args {
  target: number;
  rpm: number;
  batch: number;
  max?: number;
  subject?: string;
  chapter?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { target: 45, rpm: 12, batch: 8 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = argv[i + 1];
    switch (a) {
      case "--target": args.target = Number(val); i++; break;
      case "--rpm": args.rpm = Number(val); i++; break;
      case "--batch": args.batch = Number(val); i++; break;
      case "--max": args.max = Number(val); i++; break;
      case "--subject": args.subject = val; i++; break;
      case "--chapter": args.chapter = val; i++; break;
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  let provider: Provider;
  try {
    provider = new PacedProvider(getProvider(), Math.ceil(60_000 / args.rpm));
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      console.error(
        "AI_API_KEY is not set. Add your Gemini key to .env, then re-run:\n" +
          '  AI_PROVIDER="gemini"\n  AI_MODEL="gemini-2.0-flash"\n  AI_API_KEY="..."',
      );
      process.exit(1);
    }
    throw err;
  }

  const chapters = await prisma.chapter.findMany({
    where: {
      ntaIncluded: true,
      ...(args.chapter ? { id: args.chapter } : {}),
      ...(args.subject ? { subject: { name: args.subject } } : {}),
    },
    orderBy: [{ weighting: "desc" }, { order: "asc" }],
    include: { subject: true },
  });

  if (chapters.length === 0) {
    console.error("No matching chapters. Did you run db:load-chapters?");
    process.exit(1);
  }

  console.log(
    `Filling ${chapters.length} chapter(s) to ${args.target} questions each ` +
      `via ${provider.name}/${provider.model} @ ~${args.rpm} rpm.` +
      (args.max ? ` Budget: ${args.max} new this run.` : ""),
  );

  let budget = args.max ?? Infinity;
  let totalAdded = 0;

  for (const chapter of chapters) {
    if (budget <= 0) {
      console.log(`\nBudget reached (${args.max} questions). Re-run to continue.`);
      break;
    }
    process.stdout.write(`\n[${chapter.subject.name}] ${chapter.title} … `);
    try {
      const res = await fillChapter(prisma, provider, chapter, {
        target: args.target,
        batch: args.batch,
        maxAdd: budget,
        onSaved: () => process.stdout.write("."),
      });
      budget -= res.added;
      totalAdded += res.added;
      console.log(` +${res.added} (now ${res.existing + res.added}/${args.target})`);
    } catch (err) {
      console.log(` ✗ ${err instanceof Error ? err.message.slice(0, 100) : err}`);
    }
  }

  console.log(`\nDone. Added ${totalAdded} validated questions this run.`);
}

// Only run when invoked directly (so tests can import fillChapter).
const invokedDirectly = process.argv[1]?.includes("generateBank");
if (invokedDirectly) {
  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
