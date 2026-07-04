// Provider-agnostic AI engine contracts (SPEC §4).
// One interface, adapters for Gemini / Anthropic / OpenAI-compatible.

export interface GenerateOptions {
  /** System-level instruction. */
  system: string;
  /** User prompt. */
  prompt: string;
  /** Lower = more deterministic. Question generation wants low. */
  temperature?: number;
  maxTokens?: number;
}

export interface Provider {
  readonly name: string;
  readonly model: string;
  /** Returns raw model text. Callers parse/validate. */
  generate(opts: GenerateOptions): Promise<string>;
}

/** Shape the questions task must produce (before validation). */
export interface GeneratedQuestion {
  stem: string;
  options: [string, string, string, string];
  correctIndex: number; // 0..3
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
}
