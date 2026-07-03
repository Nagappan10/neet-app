import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractPages } from "./lib/pdf.js";

/**
 * Parses NEET past-year papers into structured questions.
 *
 * Only papers where a correct answer is available are ingested (the spec
 * requires every bank question to have a verified answer):
 *   - 2019: answers inline as "Ans. (n)"
 *   - 2025: questions in the paper, answers in a separate answer-key PDF
 *
 * Other papers are scanned images (need OCR) or lack an answer key in the
 * provided set; those are reported and skipped rather than guessed at.
 *
 * Formula/diagram-heavy Physics & Chemistry stems lose notation when
 * extracted from PDF, so each question gets a `clean` quality flag. Only
 * clean questions are marked validated on load; the rest are held for the
 * M3 content agent to normalise into proper KaTeX.
 */

const dirname = path.dirname(fileURLToPath(import.meta.url));
const REFERENCE = path.resolve(dirname, "../../reference");
const OUT = path.resolve(dirname, "../data/questions.json");

export interface ParsedQuestion {
  source: string; // "pyq-2019"
  year: number;
  number: number;
  subject: string; // Physics | Chemistry | Botany | Zoology
  stem: string;
  options: string[]; // 4
  correctIndex: number; // 0..3
  isDiagram: boolean;
  clean: boolean; // passed the extraction-quality gate
}

/** NEET question-number → subject. 45 per subject, Biology split 91-135/136-180. */
function subjectForNumber(n: number): string {
  if (n <= 45) return "Physics";
  if (n <= 90) return "Chemistry";
  if (n <= 135) return "Botany";
  return "Zoology";
}

function cleanText(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

/**
 * Quality gate. A stem/option set is "clean" when it reads as coherent text.
 * We reject the common extraction-damage signatures: empty/なfragment options,
 * stems dominated by isolated single characters (flattened formulae/structures),
 * or stray diagram residue.
 */
function isClean(stem: string, options: string[]): boolean {
  if (options.length !== 4) return false;
  if (options.some((o) => o.trim().length === 0)) return false;
  if (stem.length < 15) return false;

  const combined = `${stem} ${options.join(" ")}`;
  const tokens = combined.split(/\s+/).filter(Boolean);
  if (tokens.length < 6) return false;
  // Share of 1-character tokens — high share signals shattered formulae/structures.
  const singles = tokens.filter((t) => t.replace(/[^A-Za-z0-9]/g, "").length === 1).length;
  if (singles / tokens.length > 0.32) return false;
  return true;
}

const OPT_SPLIT = /\((?:1|2|3|4)\)/;

/** Split a "(1) a (2) b (3) c (4) d" tail into four option strings. */
function parseOptions(tail: string): string[] | null {
  // Normalise "(1 )" etc. then split on the markers, keeping 4 parts after (1).
  const marks = [...tail.matchAll(/\((1|2|3|4)\)/g)];
  if (marks.length < 4) return null;
  const idxOf: Record<string, number> = {};
  for (const m of marks) {
    const k = m[1]!;
    if (idxOf[k] === undefined) idxOf[k] = m.index!;
  }
  if (["1", "2", "3", "4"].some((k) => idxOf[k] === undefined)) return null;
  const bounds = [idxOf["1"]!, idxOf["2"]!, idxOf["3"]!, idxOf["4"]!];
  // Options must appear in order.
  for (let i = 1; i < 4; i++) if (bounds[i]! <= bounds[i - 1]!) return null;
  const opts: string[] = [];
  for (let i = 0; i < 4; i++) {
    const from = bounds[i]! + tail.slice(bounds[i]!).indexOf(")") + 1;
    const to = i < 3 ? bounds[i + 1]! : tail.length;
    opts.push(cleanText(tail.slice(from, to)));
  }
  return opts;
}

/** Parse the 2019 paper: "N. stem (1)..(2)..(3)..(4).. Ans. (k)". */
function parse2019(full: string): ParsedQuestion[] {
  const out: ParsedQuestion[] = [];
  // Each question block runs from "N." to the next "Ans. (…)" inclusive.
  const re = /(?:^|\s)(\d{1,3})\.\s+(.*?)Ans\.?\s*\(([\d,\s]+)\)/gs;
  let m: RegExpExecArray | null;
  while ((m = re.exec(full)) !== null) {
    const number = Number(m[1]);
    if (number < 1 || number > 180) continue;
    const block = m[2]!;
    const answers = m[3]!.split(",").map((x) => Number(x.trim()));
    if (answers.length !== 1) continue; // skip bonus/multi-answer items
    const correct = answers[0]!;
    if (correct < 1 || correct > 4) continue;

    const firstOpt = block.search(OPT_SPLIT);
    if (firstOpt < 0) continue;
    const stem = cleanText(block.slice(0, firstOpt).replace(/[A-Z]{4,}[^.]*$/, ""));
    const options = parseOptions(block.slice(firstOpt));
    if (!options) continue;

    const subject = subjectForNumber(number);
    const isDiagram = /\bfigure|shown|diagram|graph\b/i.test(stem);
    out.push({
      source: "pyq-2019",
      year: 2019,
      number,
      subject,
      stem,
      options,
      correctIndex: correct - 1,
      isDiagram,
      clean: isClean(stem, options) && !isDiagram,
    });
  }
  return out;
}

/** Parse the 2025 paper ("N . stem (1)..(4)..") with answers from the key file. */
function parse2025(full: string, key: Map<number, number>): ParsedQuestion[] {
  const out: ParsedQuestion[] = [];
  // Question numbers appear as "N ." ; capture up to the next question number.
  const re = /(?:^|\s)(\d{1,3})\s?\.\s+(.*?)(?=\s\d{1,3}\s?\.\s|\[Contd|$)/gs;
  let m: RegExpExecArray | null;
  let expected = 1;
  while ((m = re.exec(full)) !== null) {
    const number = Number(m[1]);
    // Keep the sequence monotone to avoid matching stray numbers in stems.
    if (number !== expected) continue;
    const block = m[2]!;
    const correct = key.get(number);
    if (!correct || correct < 1 || correct > 4) {
      expected++;
      continue;
    }
    const firstOpt = block.search(OPT_SPLIT);
    if (firstOpt < 0) {
      expected++;
      continue;
    }
    const stem = cleanText(block.slice(0, firstOpt));
    const options = parseOptions(block.slice(firstOpt));
    expected++;
    if (!options) continue;

    const subject = subjectForNumber(number);
    const isDiagram = /\bfigure|shown|diagram|graph|circuit\b/i.test(stem);
    out.push({
      source: "pyq-2025",
      year: 2025,
      number,
      subject,
      stem,
      options,
      correctIndex: correct - 1,
      isDiagram,
      clean: isClean(stem, options) && !isDiagram,
    });
  }
  return out;
}

function parseAnswerKey(text: string): Map<number, number> {
  const key = new Map<number, number>();
  // "1. (2)" or "153. ( 3 )"
  const re = /(\d{1,3})\.\s*\(\s*([\d,]+)\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1]);
    const ans = m[2]!.split(",").map((x) => Number(x));
    if (ans.length === 1 && ans[0]! >= 1 && ans[0]! <= 4 && n >= 1 && n <= 180) {
      key.set(n, ans[0]!);
    }
  }
  return key;
}

async function fullText(file: string): Promise<string> {
  const pages = await extractPages(path.join(REFERENCE, file));
  return pages.map((p) => p.text).join("\n");
}

/**
 * The 2025 answer-key PDF has one page per booklet code (E/F/G/H). The paper
 * we parse is Code 45 (page 1), so we must read only the matching page —
 * scanning all pages would let a different code's answers overwrite it.
 */
async function answerKeyForCode45(file: string): Promise<Map<number, number>> {
  const pages = await extractPages(path.join(REFERENCE, file));
  const page = pages.find((p) => /\b45\b\s*ENGLISH/i.test(p.text)) ?? pages[0]!;
  return parseAnswerKey(page.text);
}

async function main(): Promise<void> {
  const all: ParsedQuestion[] = [];

  // 2019 — inline answers
  const q2019 = parse2019(await fullText("neet 2019.pdf"));
  all.push(...q2019);

  // 2025 — paper + separate answer key (Code 45 page only)
  const key2025 = await answerKeyForCode45("neet 2025.pdf");
  const q2025 = parse2025(await fullText("neet 2025 (1).pdf"), key2025);
  all.push(...q2025);

  const bySource = (src: string) => all.filter((q) => q.source === src);
  for (const src of ["pyq-2019", "pyq-2025"]) {
    const qs = bySource(src);
    const clean = qs.filter((q) => q.clean).length;
    console.log(
      `${src}: ${qs.length} parsed, ${clean} clean (validated), ${qs.length - clean} held for agent cleanup`,
    );
  }
  const bySubject: Record<string, number> = {};
  for (const q of all.filter((q) => q.clean)) bySubject[q.subject] = (bySubject[q.subject] ?? 0) + 1;
  console.log("Clean by subject:", bySubject);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(all, null, 2));
  console.log(`\nWrote ${all.length} questions → ${path.relative(process.cwd(), OUT)}`);
  console.log(
    "Skipped (scanned, need OCR): 2017, 2020, 2021, 2022. " +
      "Parsed-but-no-answer-key (not ingested): 2016, 2018, 2023, 2024.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
