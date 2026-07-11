import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" || v === undefined ? undefined : v);

const booleanFlag = z.preprocess((v) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return ["1", "true", "yes", "on"].includes(v.toLowerCase());
  return false;
}, z.boolean());

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /**
   * Demo mode gates ALL simulated intelligence. It defaults to false and must be
   * deliberately enabled. It is refused entirely in production.
   */
  VANE_DEMO_MODE: booleanFlag.default(false),

  DATABASE_URL: z.preprocess(emptyToUndefined, z.string().optional()),
  REDIS_URL: z.preprocess(emptyToUndefined, z.string().optional()),

  // Canonical production RPC configuration (audit §1.4)
  ROBINHOOD_RPC_PRIMARY: z.preprocess(emptyToUndefined, z.string().url().optional()),
  ROBINHOOD_RPC_BACKUP: z.preprocess(emptyToUndefined, z.string().url().optional()),
  ROBINHOOD_RPC_ARCHIVE: z.preprocess(emptyToUndefined, z.string().url().optional()),
  ROBINHOOD_WS_PRIMARY: z.preprocess(emptyToUndefined, z.string().optional()),
  ROBINHOOD_WS_BACKUP: z.preprocess(emptyToUndefined, z.string().optional()),

  // Legacy names kept for local development compatibility
  ROBINHOOD_MAINNET_RPC_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  ROBINHOOD_MAINNET_RPC_BACKUP_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  ROBINHOOD_MAINNET_WS_URL: z.preprocess(emptyToUndefined, z.string().optional()),
  ROBINHOOD_TESTNET_RPC_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  ROBINHOOD_TESTNET_RPC_BACKUP_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  ROBINHOOD_TESTNET_WS_URL: z.preprocess(emptyToUndefined, z.string().optional()),

  APP_URL: z.string().default("http://localhost:3000"),
  API_URL: z.string().default("http://localhost:4000"),
  API_PORT: z.coerce.number().default(4000),

  /** Comma-separated list of allowed browser origins. Required in production. */
  CORS_ORIGINS: z.preprocess(emptyToUndefined, z.string().optional()),

  INTERNAL_API_SECRET: z.preprocess(emptyToUndefined, z.string().min(16).optional()),
  AUTH_SECRET: z.preprocess(emptyToUndefined, z.string().min(16).optional()),

  TELEGRAM_PAIRS_BOT_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  TELEGRAM_PAIRS_WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  TELEGRAM_INTELLIGENCE_BOT_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  TELEGRAM_INTELLIGENCE_WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),

  AI_PROVIDER_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  AI_MODEL: z.string().default("gpt-4o-mini"),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(120),
  INDEXER_WORKERS: z.coerce.number().default(2),
  INDEXER_POLL_MS: z.coerce.number().default(4000),
  ACTIVE_CHAIN: z.enum(["mainnet", "testnet"]).default("mainnet"),
});

export interface VaneEnv extends z.infer<typeof envSchema> {
  /** Resolved effective values (canonical names win over legacy names). */
  rpc: {
    primary: string;
    backup?: string;
    archive?: string;
    wsPrimary?: string;
    wsBackup?: string;
  };
  isProduction: boolean;
  demoMode: boolean;
}

const PUBLIC_MAINNET_RPC = "https://rpc.mainnet.chain.robinhood.com";
const PUBLIC_TESTNET_RPC = "https://rpc.testnet.chain.robinhood.com";

/** Variables that must be explicitly provided in production. */
const REQUIRED_IN_PRODUCTION = [
  "DATABASE_URL",
  "REDIS_URL",
  "ROBINHOOD_RPC_PRIMARY",
  "ROBINHOOD_RPC_BACKUP",
  "CORS_ORIGINS",
  "INTERNAL_API_SECRET",
  "AUTH_SECRET",
] as const;

let cached: VaneEnv | null = null;

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): VaneEnv {
  if (cached) return cached;

  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment:\n${msg}`);
  }
  const env = parsed.data;
  const isProduction = env.NODE_ENV === "production";

  if (isProduction) {
    const missing = REQUIRED_IN_PRODUCTION.filter((key) => !env[key]);
    if (missing.length > 0) {
      throw new Error(
        `Refusing to start in production. Missing required environment variables:\n` +
          missing.map((m) => `  - ${m}`).join("\n"),
      );
    }
    if (env.VANE_DEMO_MODE) {
      throw new Error(
        "Refusing to start: VANE_DEMO_MODE must not be enabled in production. " +
          "Demo intelligence can never be served as live data.",
      );
    }
    const usesPublicRpc =
      env.ROBINHOOD_RPC_PRIMARY === PUBLIC_MAINNET_RPC ||
      env.ROBINHOOD_RPC_BACKUP === PUBLIC_MAINNET_RPC;
    if (usesPublicRpc) {
      throw new Error(
        "Refusing to start: the rate-limited public Robinhood RPC cannot be a production provider. " +
          "Configure dedicated providers via ROBINHOOD_RPC_PRIMARY / ROBINHOOD_RPC_BACKUP.",
      );
    }
  }

  const testnet = env.ACTIVE_CHAIN === "testnet";
  const legacyPrimary = testnet ? env.ROBINHOOD_TESTNET_RPC_URL : env.ROBINHOOD_MAINNET_RPC_URL;
  const legacyBackup = testnet
    ? env.ROBINHOOD_TESTNET_RPC_BACKUP_URL
    : env.ROBINHOOD_MAINNET_RPC_BACKUP_URL;
  const legacyWs = testnet ? env.ROBINHOOD_TESTNET_WS_URL : env.ROBINHOOD_MAINNET_WS_URL;
  const publicDefault = testnet ? PUBLIC_TESTNET_RPC : PUBLIC_MAINNET_RPC;

  const resolved: VaneEnv = {
    ...env,
    isProduction,
    demoMode: env.VANE_DEMO_MODE,
    rpc: {
      primary: env.ROBINHOOD_RPC_PRIMARY ?? legacyPrimary ?? publicDefault,
      backup: env.ROBINHOOD_RPC_BACKUP ?? legacyBackup,
      archive: env.ROBINHOOD_RPC_ARCHIVE,
      wsPrimary: env.ROBINHOOD_WS_PRIMARY ?? legacyWs,
      wsBackup: env.ROBINHOOD_WS_BACKUP,
    },
  };

  cached = resolved;
  return resolved;
}

export function resetEnvCache() {
  cached = null;
}
