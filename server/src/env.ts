import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

// Load the repo-root .env (works from src/ in dev and dist/ in prod), then any
// local one. Real environment variables always win — dotenv never overrides.
const dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(dirname, "../../.env") });
dotenv.config();

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 chars"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  // AI engine — provider-agnostic. Swapping providers is env-only.
  AI_PROVIDER: z.enum(["gemini", "anthropic", "openai-compatible"]).default("gemini"),
  AI_MODEL: z.string().default("gemini-2.0-flash"),
  AI_API_KEY: z.string().default(""),
  // openai-compatible only: base URL of the endpoint
  AI_BASE_URL: z.string().default("https://api.openai.com/v1"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  // Fail fast with a readable message instead of crashing mid-request later.
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
