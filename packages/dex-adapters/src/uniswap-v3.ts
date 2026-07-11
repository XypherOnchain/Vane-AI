import { decodeEventLog, parseAbi, toEventSelector } from "viem";
import { getIntegration } from "@vane/chain";
import type { ChainLog, DexAdapter, LiquidityEvent, PoolCreatedEvent, SwapEvent } from "./types.js";

const factoryAbi = parseAbi([
  "event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)",
]);

const poolAbi = parseAbi([
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
  "event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)",
  "event Burn(address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)",
]);

export const UNISWAP_V3_TOPICS = {
  poolCreated: toEventSelector(factoryAbi[0]),
  swap: toEventSelector(poolAbi[0]),
  mint: toEventSelector(poolAbi[1]),
  burn: toEventSelector(poolAbi[2]),
} as const;

function lower(a: string): `0x${string}` {
  return a.toLowerCase() as `0x${string}`;
}

export function createUniswapV3Adapter(): DexAdapter {
  const integration = getIntegration("uniswap-v3");
  if (!integration) throw new Error("uniswap-v3 missing from integration registry");
  const factory = integration.contracts.find((c) => c.name === "V3Factory");
  if (!factory) throw new Error("uniswap-v3 registry entry has no V3Factory contract");
  const factoryAddress = lower(factory.address);

  return {
    id: "uniswap-v3",
    startBlock: integration.startBlock,
    factoryContracts: [factoryAddress],

    decodePoolCreated(log: ChainLog): PoolCreatedEvent | null {
      if (lower(log.address) !== factoryAddress) return null;
      if (log.topics[0] !== UNISWAP_V3_TOPICS.poolCreated) return null;
      const decoded = decodeEventLog({
        abi: factoryAbi,
        data: log.data,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      return {
        kind: "pool_created",
        dexId: "uniswap-v3",
        pool: lower(decoded.args.pool),
        token0: lower(decoded.args.token0),
        token1: lower(decoded.args.token1),
        feePpm: Number(decoded.args.fee),
        tickSpacing: Number(decoded.args.tickSpacing),
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
      };
    },

    decodeSwap(log: ChainLog): SwapEvent | null {
      if (log.topics[0] !== UNISWAP_V3_TOPICS.swap) return null;
      const decoded = decodeEventLog({
        abi: poolAbi,
        eventName: "Swap",
        data: log.data,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      return {
        kind: "swap",
        dexId: "uniswap-v3",
        pool: lower(log.address),
        sender: lower(decoded.args.sender),
        recipient: lower(decoded.args.recipient),
        amount0: decoded.args.amount0,
        amount1: decoded.args.amount1,
        sqrtPriceX96: decoded.args.sqrtPriceX96,
        liquidity: decoded.args.liquidity,
        tick: Number(decoded.args.tick),
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
      };
    },

    decodeLiquidityChange(log: ChainLog): LiquidityEvent | null {
      const topic = log.topics[0];
      if (topic === UNISWAP_V3_TOPICS.mint) {
        const decoded = decodeEventLog({
          abi: poolAbi,
          eventName: "Mint",
          data: log.data,
          topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
        });
        return {
          kind: "liquidity",
          dexId: "uniswap-v3",
          pool: lower(log.address),
          direction: "add",
          owner: lower(decoded.args.owner),
          amount: decoded.args.amount,
          amount0: decoded.args.amount0,
          amount1: decoded.args.amount1,
          tickLower: Number(decoded.args.tickLower),
          tickUpper: Number(decoded.args.tickUpper),
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          logIndex: log.logIndex,
        };
      }
      if (topic === UNISWAP_V3_TOPICS.burn) {
        const decoded = decodeEventLog({
          abi: poolAbi,
          eventName: "Burn",
          data: log.data,
          topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
        });
        return {
          kind: "liquidity",
          dexId: "uniswap-v3",
          pool: lower(log.address),
          direction: "remove",
          owner: lower(decoded.args.owner),
          amount: decoded.args.amount,
          amount0: decoded.args.amount0,
          amount1: decoded.args.amount1,
          tickLower: Number(decoded.args.tickLower),
          tickUpper: Number(decoded.args.tickUpper),
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          logIndex: log.logIndex,
        };
      }
      return null;
    },
  };
}
