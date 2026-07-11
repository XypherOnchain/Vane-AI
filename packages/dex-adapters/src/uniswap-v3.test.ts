import { describe, expect, it } from "vitest";
import { createUniswapV3Adapter, UNISWAP_V3_TOPICS } from "./uniswap-v3.js";
import {
  uniswapV3MintLog,
  uniswapV3PoolCreatedLog,
  uniswapV3SwapLog,
  noxaTokenCreatedLog,
} from "./fixtures.js";

const adapter = createUniswapV3Adapter();

describe("Uniswap V3 adapter — real Robinhood Chain fixtures", () => {
  it("computes the canonical event selectors", () => {
    expect(UNISWAP_V3_TOPICS.poolCreated).toBe(
      "0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118",
    );
    expect(UNISWAP_V3_TOPICS.swap).toBe(
      "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67",
    );
  });

  it("decodes a live PoolCreated (WETH / NOXA launch, 1% fee tier)", () => {
    const evt = adapter.decodePoolCreated(uniswapV3PoolCreatedLog);
    expect(evt).not.toBeNull();
    expect(evt!.token0).toBe("0x0bd7d308f8e1639fab988df18a8011f41eacad73"); // WETH
    expect(evt!.token1).toBe("0xb2ecfa42460876c897331c2e4c3fc78d0547f9af"); // launched token
    expect(evt!.feePpm).toBe(10000); // 1% tier
    expect(evt!.tickSpacing).toBe(200);
    expect(evt!.pool).toBe("0x6d7a05c5578f2b763d8e27ee302dda9047772c2c");
    expect(evt!.blockNumber).toBe(6496859n);
  });

  it("decodes a live Swap (launch dev-buy of ~0.0433 ETH)", () => {
    const evt = adapter.decodeSwap(uniswapV3SwapLog);
    expect(evt).not.toBeNull();
    expect(evt!.pool).toBe("0x6d7a05c5578f2b763d8e27ee302dda9047772c2c");
    expect(evt!.amount0).toBe(43290000000000000n); // 0.04329 WETH in
    expect(evt!.amount1).toBeLessThan(0n); // token out
    expect(evt!.tick).toBe(203577);
  });

  it("decodes a live Mint as a liquidity add", () => {
    const evt = adapter.decodeLiquidityChange(uniswapV3MintLog);
    expect(evt).not.toBeNull();
    expect(evt!.direction).toBe("add");
    expect(evt!.owner).toBe("0x73991a25c818bf1f1128deaab1492d45638de0d3"); // NFT position manager
    expect(evt!.tickLower).toBe(-887200);
    expect(evt!.tickUpper).toBe(204200);
  });

  it("ignores logs from other contracts and other events", () => {
    expect(adapter.decodePoolCreated(noxaTokenCreatedLog)).toBeNull();
    expect(adapter.decodeSwap(uniswapV3PoolCreatedLog)).toBeNull();
    expect(adapter.decodeLiquidityChange(uniswapV3SwapLog)).toBeNull();
  });
});
