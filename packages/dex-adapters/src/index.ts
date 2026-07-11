export type { ChainLog, DexAdapter, LiquidityEvent, PoolCreatedEvent, SwapEvent } from "./types.js";
export { createUniswapV3Adapter, UNISWAP_V3_TOPICS } from "./uniswap-v3.js";
export { createUniswapV2Adapter, UNISWAP_V2_TOPICS } from "./uniswap-v2.js";

import type { DexAdapter } from "./types.js";
import { createUniswapV3Adapter } from "./uniswap-v3.js";
import { createUniswapV2Adapter } from "./uniswap-v2.js";

/** All DEX adapters that are implemented AND enabled in the integration registry. */
export function enabledDexAdapters(): DexAdapter[] {
  return [createUniswapV3Adapter(), createUniswapV2Adapter()];
}
