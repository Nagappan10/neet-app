import type { GenerateOptions, Provider } from "../types.js";

/**
 * Any OpenAI-compatible chat-completions endpoint (OpenAI, GLM, local servers).
 * Configure the base URL via AI_BASE_URL.
 */
export class OpenAICompatibleProvider implements Provider {
  readonly name = "openai-compatible";
  constructor(
    readonly model: string,
    private readonly apiKey: string,
    private readonly baseUrl: string,
  ) {}

  async generate(opts: GenerateOptions): Promise<string> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 4096,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.prompt },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI-compatible API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text) throw new Error("OpenAI-compatible endpoint returned an empty response");
    return text;
  }
}
