/**
 * Real market data for Robinhood Chain via GeckoTerminal's `robinhood`
 * network (no API key required; a paid CoinGecko key upgrades rate limits).
 * Ported from the battle-tested SCALE protocol implementation.
 *
 * This is an external indexer feed: values are labeled with their source and
 * freshness, and absence of data is reported honestly (null), never invented.
 */

const GT_NETWORK = "robinhood";
const WETH_ROBINHOOD = "0x0bd7d308f8e1639fab988df18a8011f41eacad73";

function gtBase(): string {
  return (process.env.COINGECKO_API_KEY ?? "").trim()
    ? "https://pro-api.coingecko.com/api/v3/onchain"
    : "https://api.geckoterminal.com/api/v2";
}

function gtHeaders(): Record<string, string> {
  const key = (process.env.COINGECKO_API_KEY ?? "").trim();
  return key
    ? { Accept: "application/json", "x-cg-pro-api-key": key }
    : { Accept: "application/json" };
}

async function gtFetch(path: string): Promise<unknown> {
  const res = await fetch(`${gtBase()}${path}`, {
    headers: gtHeaders(),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`GeckoTerminal ${res.status} on ${path}`);
  return res.json();
}

const num = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export interface TokenMarketData {
  source: "geckoterminal";
  fetchedAt: string;
  priceUsd: number;
  priceChange24hPct: number;
  volume24hUsd: number;
  marketCapUsd: number;
  fdvUsd: number;
  liquidityUsd: number;
  logoUrl: string | null;
  topPool: string | null;
}

/** ETH/USD via WETH price on Robinhood Chain (60s cache, stale-if-error). */
let ethUsdCache: { price: number; at: number } | null = null;
export async function fetchEthUsd(): Promise<number> {
  if (ethUsdCache && Date.now() - ethUsdCache.at < 60_000) return ethUsdCache.price;
  try {
    const json = (await gtFetch(
      `/simple/networks/${GT_NETWORK}/token_price/${WETH_ROBINHOOD}`,
    )) as { data?: { attributes?: { token_prices?: Record<string, string> } } };
    const prices = json?.data?.attributes?.token_prices ?? {};
    const price = num(prices[WETH_ROBINHOOD]);
    if (price > 0) ethUsdCache = { price, at: Date.now() };
  } catch {
    /* keep stale value */
  }
  return ethUsdCache?.price ?? 0;
}

const tokenCache = new Map<string, { data: TokenMarketData | null; at: number }>();
const TOKEN_TTL_MS = 30_000;

/** Market snapshot for one token, or null when GeckoTerminal has no coverage. */
export async function fetchTokenMarket(address: string): Promise<TokenMarketData | null> {
  const key = address.toLowerCase();
  const hit = tokenCache.get(key);
  if (hit && Date.now() - hit.at < TOKEN_TTL_MS) return hit.data;
  try {
    const json = (await gtFetch(
      `/networks/${GT_NETWORK}/tokens/${key}?include=top_pools`,
    )) as {
      data?: { attributes?: Record<string, unknown> };
      included?: { attributes?: Record<string, unknown> }[];
    };
    const a = json.data?.attributes ?? {};
    const topPool = json.included?.[0]?.attributes ?? {};
    const priceChange = (topPool as { price_change_percentage?: { h24?: unknown } })
      .price_change_percentage;
    const volume = (a as { volume_usd?: { h24?: unknown } }).volume_usd;
    const poolVolume = (topPool as { volume_usd?: { h24?: unknown } }).volume_usd;
    const data: TokenMarketData = {
      source: "geckoterminal",
      fetchedAt: new Date().toISOString(),
      priceUsd: num(a.price_usd),
      priceChange24hPct: num(priceChange?.h24),
      volume24hUsd: num(volume?.h24) || num(poolVolume?.h24),
      marketCapUsd: num(a.market_cap_usd) || num(a.fdv_usd),
      fdvUsd: num(a.fdv_usd) || num(a.market_cap_usd),
      liquidityUsd: num(a.total_reserve_in_usd) || num(topPool.reserve_in_usd),
      logoUrl:
        typeof a.image_url === "string" && a.image_url !== "missing.png" ? a.image_url : null,
      topPool:
        typeof topPool.address === "string" ? (topPool.address as string).toLowerCase() : null,
    };
    const result = data.priceUsd > 0 ? data : null;
    tokenCache.set(key, { data: result, at: Date.now() });
    return result;
  } catch {
    tokenCache.set(key, { data: null, at: Date.now() });
    return null;
  }
}

export interface BulkTokenMarket {
  priceUsd: number;
  marketCapUsd: number;
  fdvUsd: number;
  liquidityUsd: number;
  volume24hUsd: number;
  logoUrl: string | null;
}

/**
 * Market data for many tokens in one call (GT tokens/multi accepts 30 per
 * request). Cached 30s. Tokens without coverage are simply absent from the map.
 */
const bulkCache = new Map<string, { data: BulkTokenMarket | null; at: number }>();
const BULK_TTL_MS = 30_000;

export async function fetchTokenMarketBulk(
  addresses: string[],
): Promise<Map<string, BulkTokenMarket>> {
  const out = new Map<string, BulkTokenMarket>();
  const missing: string[] = [];
  const now = Date.now();
  for (const raw of addresses) {
    const addr = raw.toLowerCase();
    const hit = bulkCache.get(addr);
    if (hit && now - hit.at < BULK_TTL_MS) {
      if (hit.data) out.set(addr, hit.data);
    } else {
      missing.push(addr);
    }
  }
  for (let i = 0; i < missing.length; i += 30) {
    const chunk = missing.slice(i, i + 30);
    try {
      const json = (await gtFetch(
        `/networks/${GT_NETWORK}/tokens/multi/${chunk.join(",")}`,
      )) as { data?: { attributes?: Record<string, unknown> }[] };
      const seen = new Set<string>();
      for (const t of json.data ?? []) {
        const a = t.attributes ?? {};
        const addr = String(a.address ?? "").toLowerCase();
        if (!addr) continue;
        seen.add(addr);
        const volume = (a as { volume_usd?: { h24?: unknown } }).volume_usd;
        const data: BulkTokenMarket = {
          priceUsd: num(a.price_usd),
          marketCapUsd: num(a.market_cap_usd) || num(a.fdv_usd),
          fdvUsd: num(a.fdv_usd),
          liquidityUsd: num(a.total_reserve_in_usd),
          volume24hUsd: num(volume?.h24),
          logoUrl:
            typeof a.image_url === "string" && a.image_url !== "missing.png" ? a.image_url : null,
        };
        bulkCache.set(addr, { data, at: now });
        if (data.priceUsd > 0) out.set(addr, data);
      }
      for (const addr of chunk) {
        if (!seen.has(addr)) bulkCache.set(addr, { data: null, at: now });
      }
    } catch {
      break; // rate-limited — serve what we have, retry next refresh
    }
  }
  return out;
}

export interface NewPoolStats {
  buys1h: number;
  sells1h: number;
  buyers1h: number;
  volume1hUsd: number;
  poolCreatedAt: string | null;
}

/**
 * Fresh-pool activity (1h buys/sells/volume) from GT new_pools, keyed by base
 * token address. One request covers the 20 newest pools; cached 30s.
 */
let newPoolsCache: { data: Map<string, NewPoolStats>; at: number } | null = null;

export async function fetchNewPoolStats(): Promise<Map<string, NewPoolStats>> {
  if (newPoolsCache && Date.now() - newPoolsCache.at < 30_000) return newPoolsCache.data;
  const map = new Map<string, NewPoolStats>();
  try {
    const json = (await gtFetch(
      `/networks/${GT_NETWORK}/new_pools?include=base_token&page=1`,
    )) as {
      data?: {
        attributes?: Record<string, unknown>;
        relationships?: { base_token?: { data?: { id?: string } } };
      }[];
      included?: { id?: string; attributes?: { address?: string } }[];
    };
    const tokenAddrById = new Map<string, string>();
    for (const inc of json.included ?? []) {
      if (inc.id && inc.attributes?.address) {
        tokenAddrById.set(inc.id, inc.attributes.address.toLowerCase());
      }
    }
    for (const pool of json.data ?? []) {
      const a = pool.attributes ?? {};
      const tokenAddr = tokenAddrById.get(pool.relationships?.base_token?.data?.id ?? "");
      if (!tokenAddr || map.has(tokenAddr)) continue;
      const tx = (a as { transactions?: { h1?: Record<string, unknown> } }).transactions?.h1 ?? {};
      const vol = (a as { volume_usd?: { h1?: unknown } }).volume_usd;
      map.set(tokenAddr, {
        buys1h: num(tx.buys),
        sells1h: num(tx.sells),
        buyers1h: num(tx.buyers),
        volume1hUsd: num(vol?.h1),
        poolCreatedAt: typeof a.pool_created_at === "string" ? a.pool_created_at : null,
      });
    }
    newPoolsCache = { data: map, at: Date.now() };
  } catch {
    /* keep stale */
  }
  return newPoolsCache?.data ?? map;
}

export interface PoolTrade {
  txHash: string;
  blockUnixTime: number;
  side: "buy" | "sell";
  tokenAmount: number;
  priceUsd: number;
  volumeUsd: number;
  owner: string;
}

/** Recent real swaps for a token's top pool. */
export async function fetchTrades(address: string, limit = 30): Promise<PoolTrade[]> {
  const market = await fetchTokenMarket(address);
  const pool = market?.topPool;
  if (!pool) return [];
  try {
    const json = (await gtFetch(`/networks/${GT_NETWORK}/pools/${pool}/trades`)) as {
      data?: { attributes?: Record<string, unknown> }[];
    };
    const addr = address.toLowerCase();
    return (json.data ?? [])
      .map((t) => {
        const a = t.attributes ?? {};
        const ourTokenIsTo = String(a.to_token_address ?? "").toLowerCase() === addr;
        return {
          txHash: String(a.tx_hash ?? ""),
          blockUnixTime: Math.floor(new Date(String(a.block_timestamp ?? 0)).getTime() / 1000),
          side: (a.kind === "buy" ? "buy" : "sell") as "buy" | "sell",
          tokenAmount: ourTokenIsTo ? num(a.to_token_amount) : num(a.from_token_amount),
          priceUsd: ourTokenIsTo ? num(a.price_to_in_usd) : num(a.price_from_in_usd),
          volumeUsd: num(a.volume_in_usd),
          owner: String(a.tx_from_address ?? ""),
        };
      })
      .filter((t) => t.txHash && t.blockUnixTime > 0)
      .slice(0, limit);
  } catch {
    return [];
  }
}

export interface OhlcvCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function gtTimeframe(type: string): { tf: string; agg: number } {
  switch (type) {
    case "1m":
      return { tf: "minute", agg: 1 };
    case "5m":
      return { tf: "minute", agg: 5 };
    case "15m":
      return { tf: "minute", agg: 15 };
    case "1h":
      return { tf: "hour", agg: 1 };
    case "4h":
      return { tf: "hour", agg: 4 };
    case "1d":
      return { tf: "day", agg: 1 };
    default:
      return { tf: "hour", agg: 1 };
  }
}

/** OHLCV candles for a token's top pool (ascending time). */
export async function fetchOhlcv(address: string, type: string, limit = 300): Promise<OhlcvCandle[]> {
  const market = await fetchTokenMarket(address);
  const pool = market?.topPool;
  if (!pool) return [];
  try {
    const { tf, agg } = gtTimeframe(type);
    const json = (await gtFetch(
      `/networks/${GT_NETWORK}/pools/${pool}/ohlcv/${tf}?aggregate=${agg}&limit=${Math.min(limit, 1000)}`,
    )) as { data?: { attributes?: { ohlcv_list?: number[][] } } };
    const list = json.data?.attributes?.ohlcv_list ?? [];
    return list
      .map((c) => ({
        timestamp: c[0]!,
        open: c[1]!,
        high: c[2]!,
        low: c[3]!,
        close: c[4]!,
        volume: c[5]!,
      }))
      .filter((c) => c.timestamp > 0 && c.close > 0)
      .sort((a, b) => a.timestamp - b.timestamp);
  } catch {
    return [];
  }
}
