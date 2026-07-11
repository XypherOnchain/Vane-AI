import { describe, expect, it } from "vitest";
import { getNetworkConfig, normalizeAddress, toViemChain } from "./index.js";
import type { VaneEnv } from "@vane/config";

function fakeEnv(overrides: Partial<VaneEnv> = {}): VaneEnv {
  return {
    ACTIVE_CHAIN: "mainnet",
    rpc: {
      primary: "https://provider-a.example.com/rpc",
      backup: "https://provider-b.example.com/rpc",
      wsPrimary: "wss://provider-a.example.com/ws",
    },
    isProduction: false,
    demoMode: false,
    ...overrides,
  } as VaneEnv;
}

describe("getNetworkConfig", () => {
  it("uses resolved rpc settings for the active chain", () => {
    const cfg = getNetworkConfig(fakeEnv());
    expect(cfg.chainId).toBe(4663);
    expect(cfg.rpcUrl).toBe("https://provider-a.example.com/rpc");
    expect(cfg.rpcBackupUrl).toBe("https://provider-b.example.com/rpc");
    expect(cfg.wssUrl).toBe("wss://provider-a.example.com/ws");
  });

  it("falls back to the public endpoint for the non-active chain in development", () => {
    const cfg = getNetworkConfig(fakeEnv(), "testnet");
    expect(cfg.chainId).toBe(46630);
    expect(cfg.rpcUrl).toBe("https://rpc.testnet.chain.robinhood.com");
  });

  it("builds a viem chain with both transports", () => {
    const chain = toViemChain(getNetworkConfig(fakeEnv()));
    expect(chain.id).toBe(4663);
    expect(chain.rpcUrls.default.http).toHaveLength(2);
  });
});

describe("normalizeAddress", () => {
  it("lowercases addresses", () => {
    expect(normalizeAddress("0xABC")).toBe("0xabc");
  });
});
