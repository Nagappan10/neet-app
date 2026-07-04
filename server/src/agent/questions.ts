import type { GeneratedQuestion, Provider } from "./types.js";
import { extractJson, validateStructure, verifyAnswer } from "./validators.js";

export interface GenerateQuestionsInput {
  subject: string;
  chapterTitle: string;
  topics: string[];
  count: number;
  difficulty: "easy" | "medium" | "hard" | "mixed";
}

const SYSTEM = `You are an expert NEET UG 2026 question setter for Indian medical entrance aspirants.
You write original, NCERT-aligned multiple-choice questions that match the real NEET style and difficulty.
Rules:
- Each question has exactly 4 options, exactly one correct.
- Be factually rigorous. The correct answer must be unambiguous and defensible from NCERT.
- Write clear explanations that teach the concept, not just state the answer.
- English only. Use plain text for formulae (e.g. H2SO4, v = u + at). No markdown headers.
- Do not reuse well-known past-paper questions verbatim; write fresh ones.
Return ONLY valid JSON.`;

function buildPrompt(input: GenerateQuestionsInput): string {
  const diff =
    input.difficulty === "mixed"
      ? "a spread across easy, medium, and hard"
      : `${input.difficulty}`;
  const topicHint = input.topics.length
    ? `Focus on these tested topics: ${input.topics.slice(0, 20).join("; ")}.`
    : "";
  return `Generate ${input.count} NEET MCQs for:
Subject: ${input.subject}
Chapter: ${input.chapterTitle}
${topicHint}
Difficulty: ${diff}.

Return a JSON array. Each element:
{
  "stem": "the question text",
  "options": ["A", "B", "C", "D"],
  "correctIndex": 0,
  "explanation": "why the correct option is right",
  "difficulty": "easy" | "medium" | "hard"
}
Return only the JSON array, nothing else.`;
}

export interface GenerationResult {
  questions: GeneratedQuestion[];
  requested: number;
  rejectedStructure: number;
  rejectedAnswerCheck: number;
}

/**
 * Generates, then validates each question: structural check + a second-pass
 * answer-key verification. Only questions that pass both are returned.
 */
export async function generateQuestions(
  provider: Provider,
  input: GenerateQuestionsInput,
): Promise<GenerationResult> {
  const raw = await provider.generate({
    system: SYSTEM,
    prompt: buildPrompt(input),
    temperature: 0.5,
    maxTokens: 8192,
  });

  const parsed = extractJson(raw);
  const arr = Array.isArray(parsed) ? parsed : [parsed];

  const questions: GeneratedQuestion[] = [];
  let rejectedStructure = 0;
  let rejectedAnswerCheck = 0;

  for (const candidate of arr) {
    const structured = validateStructure(candidate);
    if (!structured) {
      rejectedStructure++;
      continue;
    }
    const ok = await verifyAnswer(provider, structured);
    if (!ok) {
      rejectedAnswerCheck++;
      continue;
    }
    questions.push(structured);
  }

  return {
    questions,
    requested: input.count,
    rejectedStructure,
    rejectedAnswerCheck,
  };
}
