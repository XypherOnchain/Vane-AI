import { beforeEach, describe, expect, it } from "vitest";
import { loadEnv, resetEnvCache } from "./index.js";

const prodBase = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://u:p@db:5432/vane",
  REDIS_URL: "redis://redis:6379",
  ROBINHOOD_RPC_PRIMARY: "https://provider-a.example.com/rpc",
  ROBINHOOD_RPC_BACKUP: "https://provider-b.example.com/rpc",
  CORS_ORIGINS: "https://vane.example.com",
  INTERNAL_API_SECRET: "internal-secret-0123456789",
  AUTH_SECRET: "auth-secret-0123456789abc",
} as NodeJS.ProcessEnv;

describe("loadEnv", () => {
  beforeEach(() => resetEnvCache());

  it("defaults VANE_DEMO_MODE to false", () => {
    const env = loadEnv({ NODE_ENV: "development" } as NodeJS.ProcessEnv);
    expect(env.demoMode).toBe(false);
  });

  it("parses demo mode flag variants", () => {
    const env = loadEnv({ NODE_ENV: "development", VANE_DEMO_MODE: "true" } as NodeJS.ProcessEnv);
    expect(env.demoMode).toBe(true);
  });

  it("falls back to the public RPC only outside production", () => {
    const env = loadEnv({ NODE_ENV: "development" } as NodeJS.ProcessEnv);
    expect(env.rpc.primary).toContain("rpc.mainnet.chain.robinhood.com");
  });

  it("accepts a fully configured production environment", () => {
    const env = loadEnv(prodBase);
    expect(env.isProduction).toBe(true);
    expect(env.rpc.primary).toBe("https://provider-a.example.com/rpc");
    expect(env.rpc.backup).toBe("https://provider-b.example.com/rpc");
  });

  it("refuses production when required variables are missing", () => {
    const { DATABASE_URL: _omit, ...rest } = prodBase;
    expect(() => loadEnv(rest as NodeJS.ProcessEnv)).toThrow(/DATABASE_URL/);
  });

  it("refuses production when demo mode is enabled", () => {
    expect(() => loadEnv({ ...prodBase, VANE_DEMO_MODE: "true" })).toThrow(/VANE_DEMO_MODE/);
  });

  it("refuses production on the public rate-limited RPC", () => {
    expect(() =>
      loadEnv({
        ...prodBase,
        ROBINHOOD_RPC_PRIMARY: "https://rpc.mainnet.chain.robinhood.com",
      }),
    ).toThrow(/public Robinhood RPC/);
  });

  it("prefers canonical RPC names over legacy names", () => {
    const env = loadEnv({
      NODE_ENV: "development",
      ROBINHOOD_RPC_PRIMARY: "https://canonical.example.com",
      ROBINHOOD_MAINNET_RPC_URL: "https://legacy.example.com",
    } as NodeJS.ProcessEnv);
    expect(env.rpc.primary).toBe("https://canonical.example.com");
  });
});
