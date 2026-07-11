import { describe, expect, it } from "vitest";
import { createNoxaAdapter } from "./noxa.js";
import {
  noxaTokenCreatedLog,
  noxaTokenLaunchedLog,
  uniswapV3PoolCreatedLog,
} from "@vane/dex-adapters/fixtures";

const adapter = createNoxaAdapter();

describe("NOXA adapter — real Robinhood Chain fixtures", () => {
  it("decodes a live TokenCreated", () => {
    const evt = adapter.decodeTokenCreated(noxaTokenCreatedLog);
    expect(evt).not.toBeNull();
    expect(evt!.token).toBe("0xb2ecfa42460876c897331c2e4c3fc78d0547f9af");
    expect(evt!.creator).toBe("0xc19ccc47dc3417caceb08102596f255adc27460d");
    expect(evt!.dexFactory).toBe("0x1f7d7550b1b028f7571e69a784071f0205fd2efa"); // Uniswap V3
    expect(evt!.quoteToken).toBe("0x0bd7d308f8e1639fab988df18a8011f41eacad73"); // WETH
  });

  it("decodes a live TokenLaunched with the created pool", () => {
    const evt = adapter.decodeLaunchCompleted(noxaTokenLaunchedLog);
    expect(evt).not.toBeNull();
    expect(evt!.token).toBe("0xb2ecfa42460876c897331c2e4c3fc78d0547f9af");
    expect(evt!.pool).toBe("0x6d7a05c5578f2b763d8e27ee302dda9047772c2c");
    expect(evt!.quoteToken).toBe("0x0bd7d308f8e1639fab988df18a8011f41eacad73");
    // Unlabeled words are preserved as raw evidence, never invented as facts.
    expect(evt!.rawDataWords.length).toBeGreaterThan(0);
  });

  it("agrees with the Uniswap PoolCreated log from the same transaction", () => {
    const launched = adapter.decodeLaunchCompleted(noxaTokenLaunchedLog)!;
    // The pool NOXA reports must match the pool Uniswap actually created.
    expect(uniswapV3PoolCreatedLog.data.includes(launched.pool.slice(2))).toBe(true);
  });

  it("ignores foreign logs", () => {
    expect(adapter.decodeTokenCreated(uniswapV3PoolCreatedLog)).toBeNull();
    expect(adapter.decodeLaunchCompleted(noxaTokenCreatedLog)).toBeNull();
  });

  it("reports no graduation events until a fixture is confirmed", () => {
    expect(adapter.decodeGraduation(noxaTokenLaunchedLog)).toBeNull();
  });
});
