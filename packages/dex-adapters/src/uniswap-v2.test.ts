import { describe, expect, it } from "vitest";
import { encodeAbiParameters, encodeEventTopics, parseAbi } from "viem";
import { createUniswapV2Adapter, UNISWAP_V2_TOPICS } from "./uniswap-v2.js";
import type { ChainLog } from "./types.js";

// The V2 ABI is canonical and immutable, so a synthetic log encoded with the
// official ABI is a faithful fixture (unlike NOXA, which needed on-chain logs).
const factoryAbi = parseAbi([
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint256 allPairsLength)",
]);

const FACTORY = "0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f" as const;
const TOKEN0 = "0x0bd7d308f8e1639fab988df18a8011f41eacad73" as const;
const TOKEN1 = "0x088b0128209cf84606aa688506fa87717ba8695b" as const;
const PAIR = "0x1111111111111111111111111111111111111111" as const;

function pairCreatedLog(): ChainLog {
  const topics = encodeEventTopics({
    abi: factoryAbi,
    eventName: "PairCreated",
    args: { token0: TOKEN0, token1: TOKEN1 },
  });
  const data = encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }],
    [PAIR, 7n],
  );
  return {
    address: FACTORY,
    topics: topics as `0x${string}`[],
    data,
    blockNumber: 123456n,
    transactionHash: `0x${"ab".repeat(32)}` as `0x${string}`,
    logIndex: 0,
  };
}

describe("uniswap-v2 adapter", () => {
  const adapter = createUniswapV2Adapter();

  it("decodes PairCreated from the canonical factory", () => {
    const event = adapter.decodePoolCreated(pairCreatedLog());
    expect(event).not.toBeNull();
    expect(event!.pool).toBe(PAIR);
    expect(event!.token0).toBe(TOKEN0);
    expect(event!.token1).toBe(TOKEN1);
    expect(event!.feePpm).toBe(3000);
    expect(event!.tickSpacing).toBeNull();
    expect(event!.dexId).toBe("uniswap-v2");
  });

  it("ignores PairCreated from unknown factories", () => {
    const log = { ...pairCreatedLog(), address: PAIR };
    expect(adapter.decodePoolCreated(log)).toBeNull();
  });

  it("exports stable topic selectors", () => {
    expect(UNISWAP_V2_TOPICS.pairCreated).toBe(
      "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9",
    );
  });
});
