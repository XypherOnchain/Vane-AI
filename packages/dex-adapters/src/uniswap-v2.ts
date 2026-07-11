import { decodeEventLog, parseAbi, toEventSelector } from "viem";
import { getIntegration } from "@vane/chain";
import type { ChainLog, DexAdapter, LiquidityEvent, PoolCreatedEvent, SwapEvent } from "./types.js";

// Canonical Uniswap V2 ABI (unchanged since 2020, same on every EVM chain).
const factoryAbi = parseAbi([
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint256 allPairsLength)",
]);

const pairAbi = parseAbi([
  "event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)",
  "event Mint(address indexed sender, uint256 amount0, uint256 amount1)",
  "event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to)",
]);

export const UNISWAP_V2_TOPICS = {
  pairCreated: toEventSelector(factoryAbi[0]),
  swap: toEventSelector(pairAbi[0]),
  mint: toEventSelector(pairAbi[1]),
  burn: toEventSelector(pairAbi[2]),
} as const;

function lower(a: string): `0x${string}` {
  return a.toLowerCase() as `0x${string}`;
}

export function createUniswapV2Adapter(): DexAdapter {
  const integration = getIntegration("uniswap-v2");
  if (!integration) throw new Error("uniswap-v2 missing from integration registry");
  const factory = integration.contracts.find((c) => c.name === "V2Factory");
  if (!factory) throw new Error("uniswap-v2 registry entry has no V2Factory contract");
  const factoryAddress = lower(factory.address);

  return {
    id: "uniswap-v2",
    startBlock: integration.startBlock,
    factoryContracts: [factoryAddress],

    decodePoolCreated(log: ChainLog): PoolCreatedEvent | null {
      if (lower(log.address) !== factoryAddress) return null;
      if (log.topics[0] !== UNISWAP_V2_TOPICS.pairCreated) return null;
      const decoded = decodeEventLog({
        abi: factoryAbi,
        data: log.data,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      return {
        kind: "pool_created",
        dexId: "uniswap-v2",
        pool: lower(decoded.args.pair),
        token0: lower(decoded.args.token0),
        token1: lower(decoded.args.token1),
        feePpm: 3000, // V2 fee is a fixed 0.3%
        tickSpacing: null,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
      };
    },

    decodeSwap(log: ChainLog): SwapEvent | null {
      if (log.topics[0] !== UNISWAP_V2_TOPICS.swap) return null;
      const decoded = decodeEventLog({
        abi: pairAbi,
        eventName: "Swap",
        data: log.data,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      return {
        kind: "swap",
        dexId: "uniswap-v2",
        pool: lower(log.address),
        sender: lower(decoded.args.sender),
        recipient: lower(decoded.args.to),
        // Net signed amounts, matching the V3 convention (positive = into pool).
        amount0: decoded.args.amount0In - decoded.args.amount0Out,
        amount1: decoded.args.amount1In - decoded.args.amount1Out,
        sqrtPriceX96: null,
        liquidity: null,
        tick: null,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
      };
    },

    decodeLiquidityChange(log: ChainLog): LiquidityEvent | null {
      const topic = log.topics[0];
      if (topic !== UNISWAP_V2_TOPICS.mint && topic !== UNISWAP_V2_TOPICS.burn) return null;
      const isMint = topic === UNISWAP_V2_TOPICS.mint;
      const decoded = decodeEventLog({
        abi: pairAbi,
        eventName: isMint ? "Mint" : "Burn",
        data: log.data,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      return {
        kind: "liquidity",
        dexId: "uniswap-v2",
        pool: lower(log.address),
        direction: isMint ? "add" : "remove",
        owner: lower(decoded.args.sender),
        amount: null,
        amount0: decoded.args.amount0,
        amount1: decoded.args.amount1,
        tickLower: null,
        tickUpper: null,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
      };
    },
  };
}
