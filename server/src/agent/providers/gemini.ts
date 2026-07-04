import type { GenerateOptions, Provider } from "../types.js";

/** Google Gemini (Generative Language API). Key from aistudio.google.com. */
export class GeminiProvider implements Provider {
  readonly name = "gemini";
  constructor(
    readonly model: string,
    private readonly apiKey: string,
  ) {}

  async generate(opts: GenerateOptions): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
        generationConfig: {
          temperature: opts.temperature ?? 0.4,
          maxOutputTokens: opts.maxTokens ?? 4096,
          responseMimeType: "application/json",
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`Gemini API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text) throw new Error("Gemini returned an empty response");
    return text;
  }
}
