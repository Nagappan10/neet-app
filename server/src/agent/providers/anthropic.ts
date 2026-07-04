import type { GenerateOptions, Provider } from "../types.js";

/** Anthropic Claude (Messages API). Key from console.anthropic.com. */
export class AnthropicProvider implements Provider {
  readonly name = "anthropic";
  constructor(
    readonly model: string,
    private readonly apiKey: string,
  ) {}

  async generate(opts: GenerateOptions): Promise<string> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: opts.maxTokens ?? 4096,
        temperature: opts.temperature ?? 0.4,
        system: opts.system,
        messages: [{ role: "user", content: opts.prompt }],
      }),
    });
    if (!res.ok) {
      throw new Error(`Anthropic API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text =
      data.content
        ?.filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("") ?? "";
    if (!text) throw new Error("Anthropic returned an empty response");
    return text;
  }
}
