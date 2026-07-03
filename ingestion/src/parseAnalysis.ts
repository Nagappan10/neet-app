import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractText } from "./lib/pdf.js";

/**
 * Parses the four "DETAILS CHAPTER WISE ANALYSIS" PDFs into a structured
 * chapter list per subject: real chapter titles, PYQ question totals
 * (the weighting), per-topic detail, difficulty split, and the prose summary.
 *
 * Table shape per chapter (whitespace-flattened):
 *   <n>. <Title> Topic <years...> Total Easy Medium Hard
 *   <TopicName> <year counts...> <total> <easy> <medium> <hard>
 *   ... more topic rows ...
 *   Total <year counts...> <total> <easy> <medium> <hard>
 *   Summary: <text> Insights: <text>
 *
 * Each row ends with (numYears + 4) integers, so we tokenise and walk
 * numbers: whenever (numYears + 4) integers accumulate, the preceding words
 * are a row label (a topic, or "Total" for the chapter total row).
 */

const dirname = path.dirname(fileURLToPath(import.meta.url));
const REFERENCE = path.resolve(dirname, "../../reference");
const OUT = path.resolve(dirname, "../data/chapters.json");

const SOURCES: { subject: string; file: string }[] = [
  { subject: "Physics", file: "PHYSICS DETAILS CHAPTER WISE ANALYSIS.pdf" },
  { subject: "Chemistry", file: "CHEMISTRY DETAILS CHAPTER WISE ANALYSIS.pdf" },
  { subject: "Botany", file: "BOTANY DETAILS CHAPTER WISE ANALYSIS (1).pdf" },
  { subject: "Zoology", file: "ZOOLOGY DETAILS CHAPTER WISE ANALYSIS.pdf" },
];

export interface TopicDetail {
  name: string;
  total: number;
  byYear: Record<string, number>;
  easy: number;
  medium: number;
  hard: number;
}

export interface ParsedChapter {
  subject: string;
  order: number;
  title: string;
  weighting: number; // total PYQ questions across analysed years
  topics: string[];
  analysis: {
    years: string[];
    byYear: Record<string, number>;
    difficulty: { easy: number; medium: number; hard: number };
    topicDetail: TopicDetail[];
    summary: string | null;
    insights: string[];
  };
}

const isInt = (t: string): boolean => /^\d+$/.test(t);

function parseChapterBlock(
  subject: string,
  order: number,
  title: string,
  years: string[],
  body: string,
): ParsedChapter {
  const cols = years.length + 4; // years + total + easy + medium + hard

  // Split body into the table part (before "Summary:") and prose.
  const summaryIdx = body.indexOf("Summary:");
  const table = summaryIdx >= 0 ? body.slice(0, summaryIdx) : body;
  const prose = summaryIdx >= 0 ? body.slice(summaryIdx) : "";

  const tokens = table.split(" ").filter(Boolean);
  const topicDetail: TopicDetail[] = [];
  let chapterTotals: number[] | null = null;

  let label: string[] = [];
  let nums: number[] = [];
  for (const tok of tokens) {
    if (isInt(tok)) {
      nums.push(Number(tok));
      if (nums.length === cols) {
        const name = label.join(" ").trim();
        const byYear: Record<string, number> = {};
        years.forEach((y, i) => (byYear[y] = nums[i] ?? 0));
        const [total, easy, medium, hard] = nums.slice(years.length);
        if (/^total$/i.test(name)) {
          chapterTotals = nums;
        } else if (name) {
          topicDetail.push({
            name,
            total: total ?? 0,
            byYear,
            easy: easy ?? 0,
            medium: medium ?? 0,
            hard: hard ?? 0,
          });
        }
        label = [];
        nums = [];
      }
    } else {
      // A stray non-integer after numbers started means the row didn't line
      // up (rare OCR noise); reset the number run, keep building the label.
      if (nums.length) nums = [];
      label.push(tok);
    }
  }

  const byYear: Record<string, number> = {};
  let easy = 0;
  let medium = 0;
  let hard = 0;
  let weighting = 0;
  if (chapterTotals) {
    years.forEach((y, i) => (byYear[y] = chapterTotals![i] ?? 0));
    weighting = chapterTotals[years.length] ?? 0;
    easy = chapterTotals[years.length + 1] ?? 0;
    medium = chapterTotals[years.length + 2] ?? 0;
    hard = chapterTotals[years.length + 3] ?? 0;
  } else {
    // No explicit total row parsed — sum the topic rows as a fallback.
    for (const t of topicDetail) {
      weighting += t.total;
      easy += t.easy;
      medium += t.medium;
      hard += t.hard;
      for (const y of years) byYear[y] = (byYear[y] ?? 0) + (t.byYear[y] ?? 0);
    }
  }

  const summaryMatch = prose.match(/Summary:\s*(.*?)(?:\s*Insights:|$)/s);
  const insightsMatch = prose.match(/Insights:\s*(.*)$/s);
  const summary = summaryMatch?.[1]?.trim() || null;
  const insights = insightsMatch?.[1]
    ? insightsMatch[1]
        .split(/[••]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 2)
    : [];

  return {
    subject,
    order,
    title,
    weighting,
    topics: topicDetail.map((t) => t.name),
    analysis: {
      years,
      byYear,
      difficulty: { easy, medium, hard },
      topicDetail,
      summary,
      insights,
    },
  };
}

async function parseFile(subject: string, file: string): Promise<ParsedChapter[]> {
  const full = await extractText(path.join(REFERENCE, file));

  // Chapter header: "<n>. <Title> Topic <year> <year> ... Total Easy Medium Hard"
  const headerRe =
    /(\d{1,3})\.\s+(.+?)\s+Topic\s+((?:20\d\d\s+)+)Total\s+(?:Questions\s+)?Easy\s+Medium\s+Hard/g;

  const headers: { num: number; title: string; years: string[]; start: number; bodyStart: number }[] =
    [];
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(full)) !== null) {
    // Some titles carry a trailing "Chapter: …" sub-header from the source
    // layout; keep only the primary chapter name.
    const rawTitle = m[2]!.replace(/\s+/g, " ").split(/\s+Chapter:\s+/i)[0]!.trim();
    headers.push({
      num: Number(m[1]),
      title: rawTitle,
      years: m[3]!.trim().split(/\s+/),
      start: m.index,
      bodyStart: headerRe.lastIndex,
    });
  }

  const chapters: ParsedChapter[] = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]!;
    const bodyEnd = i + 1 < headers.length ? headers[i + 1]!.start : full.length;
    const body = full.slice(h.bodyStart, bodyEnd);
    chapters.push(parseChapterBlock(subject, h.num, h.title, h.years, body));
  }
  return chapters;
}

async function main(): Promise<void> {
  const all: ParsedChapter[] = [];
  for (const { subject, file } of SOURCES) {
    const chapters = await parseFile(subject, file);
    const totalQ = chapters.reduce((s, c) => s + c.weighting, 0);
    console.log(
      `${subject.padEnd(10)} → ${String(chapters.length).padStart(3)} chapters, ${String(
        totalQ,
      ).padStart(4)} PYQ questions counted`,
    );
    all.push(...chapters);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(all, null, 2));
  console.log(`\nWrote ${all.length} chapters → ${path.relative(process.cwd(), OUT)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
