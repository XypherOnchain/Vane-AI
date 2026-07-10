import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" || v === undefined ? undefined : v);

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).default("postgresql://vane:vane@localhost:5432/vane"),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),

  ROBINHOOD_MAINNET_RPC_URL: z
    .string()
    .default("https://rpc.mainnet.chain.robinhood.com"),
  ROBINHOOD_MAINNET_RPC_BACKUP_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  ROBINHOOD_MAINNET_WS_URL: z.preprocess(emptyToUndefined, z.string().optional()),

  ROBINHOOD_TESTNET_RPC_URL: z
    .string()
    .default("https://rpc.testnet.chain.robinhood.com"),
  ROBINHOOD_TESTNET_RPC_BACKUP_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  ROBINHOOD_TESTNET_WS_URL: z.preprocess(emptyToUndefined, z.string().optional()),

  APP_URL: z.string().default("http://localhost:3000"),
  API_URL: z.string().default("http://localhost:4000"),
  API_PORT: z.coerce.number().default(4000),
  INTERNAL_API_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),

  TELEGRAM_PAIRS_BOT_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  TELEGRAM_PAIRS_WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  TELEGRAM_INTELLIGENCE_BOT_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  TELEGRAM_INTELLIGENCE_WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),

  // Legacy single-token support during migration
  TELEGRAM_BOT_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),

  AI_PROVIDER_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  AI_MODEL: z.string().default("gpt-4o-mini"),

  AUTH_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(120),
  INDEXER_WORKERS: z.coerce.number().default(2),
  INDEXER_POLL_MS: z.coerce.number().default(4000),
  ACTIVE_CHAIN: z.enum(["mainnet", "testnet"]).default("mainnet"),
});

export type VaneEnv = z.infer<typeof envSchema>;

let cached: VaneEnv | null = null;

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): VaneEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment:\n${msg}`);
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvCache() {
  cached = null;
}
