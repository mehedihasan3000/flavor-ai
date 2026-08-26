import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((v) => v.split(",").map((s) => s.trim())),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 chars"),
  JWT_ISSUER: z.string().min(1).default("flavorai"),
  JWT_AUDIENCE: z.string().min(1).default("flavorai-api"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z
    .enum(["openai/gpt-oss-120b", "qwen/qwen3.6-27b", "llama-3.3-70b-versatile"])
    .default("openai/gpt-oss-120b"),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  IMGBB_API_KEY: z.string().optional(),
  IMGBB_API_URL: z.string().url().default("https://api.imgbb.com/1/upload"),
});

export type Env = z.infer<typeof EnvSchema>;

const TEST_FALLBACK = {
  MONGODB_URI: "mongodb://localhost:27017/flavorai-test",
  JWT_SECRET: "test-only-secret-at-least-16-chars",
} as const;

function isTestRun(): boolean {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);

  if (parsed.success) {
    return parsed.data;
  }

  if (isTestRun()) {
    const testParsed = EnvSchema.safeParse({
      ...process.env,
      NODE_ENV: "test",
      MONGODB_URI: process.env.MONGODB_URI ?? TEST_FALLBACK.MONGODB_URI,
      JWT_SECRET: process.env.JWT_SECRET ?? TEST_FALLBACK.JWT_SECRET,
    });
    if (testParsed.success) {
      console.warn("[env] Test run: missing env vars filled with test fallbacks.");
      return testParsed.data;
    }
  }

  const issues = parsed.error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join(", ");
  const msg = `[env] Invalid environment configuration: ${issues}. Copy .env.example to .env and fill in real values.`;
  console.error(msg);
  throw new Error(msg);
}

export const env: Env = loadEnv();