import type { GeneratedQuestion, Provider } from "./types.js";

/** Extract the first JSON value from a model response (handles code fences). */
export function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1]! : raw;
  const start = body.search(/[[{]/);
  if (start < 0) throw new Error("No JSON found in model output");
  // Walk to the matching close bracket so trailing prose is ignored.
  const open = body[start]!;
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < body.length; i++) {
    const c = body[i]!;
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return JSON.parse(body.slice(start, i + 1));
    }
  }
  throw new Error("Unterminated JSON in model output");
}

const DIFFICULTIES = new Set(["easy", "medium", "hard"]);

/** Structural validation — exactly 4 options, one valid correct index, etc. */
export function validateStructure(q: unknown): GeneratedQuestion | null {
  if (typeof q !== "object" || q === null) return null;
  const o = q as Record<string, unknown>;
  const stem = o.stem;
  const options = o.options;
  const correctIndex = o.correctIndex;
  const explanation = o.explanation;
  const difficulty = o.difficulty;

  if (typeof stem !== "string" || stem.trim().length < 10) return null;
  if (!Array.isArray(options) || options.length !== 4) return null;
  if (!options.every((x) => typeof x === "string" && x.trim().length > 0)) return null;
  if (new Set(options.map((x) => (x as string).trim())).size !== 4) return null; // no dup options
  if (typeof correctIndex !== "number" || ![0, 1, 2, 3].includes(correctIndex)) return null;
  if (typeof explanation !== "string" || explanation.trim().length < 10) return null;
  if (typeof difficulty !== "string" || !DIFFICULTIES.has(difficulty)) return null;

  return {
    stem: stem.trim(),
    options: options.map((x) => (x as string).trim()) as [string, string, string, string],
    correctIndex,
    explanation: explanation.trim(),
    difficulty: difficulty as GeneratedQuestion["difficulty"],
  };
}

/**
 * Second-pass answer-key check (SPEC §4): independently re-ask the model to
 * solve its own question. Discard on mismatch so a wrong key never enters the
 * bank as validated.
 */
export async function verifyAnswer(
  provider: Provider,
  q: GeneratedQuestion,
): Promise<boolean> {
  const prompt = `Solve this NEET multiple-choice question. Reply with ONLY a JSON object {"answer": <0-based index of the correct option>}.

Question: ${q.stem}
Options:
0) ${q.options[0]}
1) ${q.options[1]}
2) ${q.options[2]}
3) ${q.options[3]}`;
  const raw = await provider.generate({
    system: "You are an expert NEET examiner. Answer with strict JSON only.",
    prompt,
    temperature: 0,
    maxTokens: 200,
  });
  try {
    const parsed = extractJson(raw) as { answer?: unknown };
    return parsed.answer === q.correctIndex;
  } catch {
    return false; // unparseable second pass = fail closed
  }
}
