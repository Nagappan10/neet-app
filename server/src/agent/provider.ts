import { env } from "../env.js";
import type { Provider } from "./types.js";
import { GeminiProvider } from "./providers/gemini.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { OpenAICompatibleProvider } from "./providers/openai.js";

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "AI_API_KEY is not set. Add it to your .env to enable on-demand generation.",
    );
  }
}

/** Builds the configured provider from env. Swapping providers is env-only. */
export function getProvider(): Provider {
  if (!env.AI_API_KEY) throw new MissingApiKeyError();
  switch (env.AI_PROVIDER) {
    case "gemini":
      return new GeminiProvider(env.AI_MODEL, env.AI_API_KEY);
    case "anthropic":
      return new AnthropicProvider(env.AI_MODEL, env.AI_API_KEY);
    case "openai-compatible":
      return new OpenAICompatibleProvider(env.AI_MODEL, env.AI_API_KEY, env.AI_BASE_URL);
  }
}

export const aiConfigured = (): boolean => env.AI_API_KEY.length > 0;
