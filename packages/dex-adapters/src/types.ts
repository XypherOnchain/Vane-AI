/** Minimal chain log shape shared by all adapters (subset of an EVM log). */
export interface ChainLog {
  address: `0x${string}`;
  topics: `0x${string}`[];
  data: `0x${string}`;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
}

export interface PoolCreatedEvent {
  kind: "pool_created";
  dexId: string;
  pool: `0x${string}`;
  token0: `0x${string}`;
  token1: `0x${string}`;
  feePpm: number;
  /** null for AMMs without concentrated liquidity (e.g. Uniswap V2). */
  tickSpacing: number | null;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
}

export interface SwapEvent {
  kind: "swap";
  dexId: string;
  pool: `0x${string}`;
  sender: `0x${string}`;
  recipient: `0x${string}`;
  amount0: bigint;
  amount1: bigint;
  /** null for AMMs without sqrt pricing (e.g. Uniswap V2). */
  sqrtPriceX96: bigint | null;
  liquidity: bigint | null;
  tick: number | null;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
}

export interface LiquidityEvent {
  kind: "liquidity";
  dexId: string;
  pool: `0x${string}`;
  direction: "add" | "remove";
  owner: `0x${string}`;
  amount: bigint | null;
  amount0: bigint;
  amount1: bigint;
  tickLower: number | null;
  tickUpper: number | null;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
}

/**
 * Contract every DEX adapter must fulfil. Decoders are deterministic and
 * return null for logs that do not belong to the adapter.
 */
export interface DexAdapter {
  id: string;
  startBlock: bigint;
  /** Factory / manager contracts whose logs identify new pools. */
  factoryContracts: `0x${string}`[];

  decodePoolCreated(log: ChainLog): PoolCreatedEvent | null;
  /** Swap/liquidity logs come from pool contracts, matched by topic. */
  decodeSwap(log: ChainLog): SwapEvent | null;
  decodeLiquidityChange(log: ChainLog): LiquidityEvent | null;
}
