import { parseAbiItem } from "viem";
import { loadEnv } from "@vane/config";
import { createRobinhoodProvider } from "@vane/chain";
import type { HolderRow } from "@vane/shared-types";

/**
 * Real holder data, two sources in preference order:
 *  1. Blockscout (official explorer) — full balance index, but flaky per-token.
 *  2. On-chain Transfer-log replay — exact balances computed from the token's
 *     entire transfer history. Only used for young tokens (bounded block range).
 * Both are real chain data; the snapshot records which source produced it.
 */

const BLOCKSCOUT = "https://robinhoodchain.blockscout.com/api/v2";

interface BlockscoutHolder {
  address: { hash: string; is_contract?: boolean; name?: string | null };
  value: string;
}

export interface HoldersSnapshot {
  source: "blockscout" | "chain";
  fetchedAt: string;
  /** Number of holders seen (capped by pagination; true count may be higher). */
  holderCount: number;
  /** true when there were more pages beyond what we fetched. */
  hasMore: boolean;
  topHolders: HolderRow[];
  /** Sum of top-holder percentages (concentration signal). */
  top10Pct: number;
}

const cache = new Map<string, { data: HoldersSnapshot | null; at: number }>();
const TTL_MS = 60_000;
const NEGATIVE_TTL_MS = 15_000; // retry failures quickly — often just a slow page
const MAX_PAGES = 3; // 50 per page — enough for young launchpad tokens

async function holdersFromBlockscout(
  key: string,
  totalSupply: string | null,
): Promise<HoldersSnapshot> {
  const items: BlockscoutHolder[] = [];
  let params = "";
  let hasMore = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(`${BLOCKSCOUT}/tokens/${key}/holders${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Blockscout ${res.status}`);
    const json = (await res.json()) as {
      items?: BlockscoutHolder[];
      next_page_params?: Record<string, string | number> | null;
    };
    items.push(...(json.items ?? []));
    if (!json.next_page_params) {
      hasMore = false;
      break;
    }
    hasMore = true;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(json.next_page_params)) qs.set(k, String(v));
    params = `?${qs.toString()}`;
  }
  if (items.length === 0) throw new Error("Blockscout returned no holders");

  const supply = totalSupply ? Number(totalSupply) : 0;
  const topHolders: HolderRow[] = items.slice(0, 25).map((h) => {
    const balance = Number(h.value);
    return {
      address: h.address.hash.toLowerCase(),
      balance: h.value,
      pctSupply: supply > 0 ? (balance / supply) * 100 : 0,
      isContract: h.address.is_contract ?? undefined,
      label: h.address.name ?? undefined,
    };
  });

  return {
    source: "blockscout",
    fetchedAt: new Date().toISOString(),
    holderCount: items.length,
    hasMore,
    topHolders,
    top10Pct: topHolders.slice(0, 10).reduce((s, h) => s + h.pctSupply, 0),
  };
}

// ── On-chain fallback: exact balances from Transfer-log replay ──────────

const env = loadEnv();
let provider: ReturnType<typeof createRobinhoodProvider> | null = null;
function getProvider() {
  if (!provider) provider = createRobinhoodProvider(env);
  return provider;
}

const TRANSFER = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);
const ZERO = "0x0000000000000000000000000000000000000000";
/** Skip replay for tokens with very long histories — that is the indexer's job. */
const MAX_REPLAY_BLOCKS = 500_000n;

type TransferLog = { args: { from?: string; to?: string; value?: bigint } };

async function transferLogs(
  token: `0x${string}`,
  fromBlock: bigint,
  toBlock: bigint,
  depth = 0,
): Promise<TransferLog[]> {
  try {
    return (await getProvider().getLogs({
      address: token,
      event: TRANSFER,
      fromBlock,
      toBlock,
    })) as unknown as TransferLog[];
  } catch (e) {
    if (depth >= 3) throw e;
    const mid = fromBlock + (toBlock - fromBlock) / 2n;
    const [a, b] = await Promise.all([
      transferLogs(token, fromBlock, mid, depth + 1),
      transferLogs(token, mid + 1n, toBlock, depth + 1),
    ]);
    return [...a, ...b];
  }
}

async function holdersFromChain(
  key: string,
  createdBlock: string | null,
): Promise<HoldersSnapshot | null> {
  if (!createdBlock) return null;
  const from = BigInt(createdBlock);
  const tip = await getProvider().getBlockNumber();
  if (tip - from > MAX_REPLAY_BLOCKS) return null;

  const logs = await transferLogs(key as `0x${string}`, from, tip);
  const balances = new Map<string, bigint>();
  let supply = 0n;
  for (const log of logs) {
    const value = log.args.value ?? 0n;
    const src = (log.args.from ?? "").toLowerCase();
    const dst = (log.args.to ?? "").toLowerCase();
    if (src === ZERO) supply += value;
    else balances.set(src, (balances.get(src) ?? 0n) - value);
    if (dst === ZERO) supply -= value;
    else balances.set(dst, (balances.get(dst) ?? 0n) + value);
  }

  const holders = [...balances.entries()]
    .filter(([, v]) => v > 0n)
    .sort((a, b) => (b[1] > a[1] ? 1 : -1));
  const supplyNum = Number(supply);
  const topHolders: HolderRow[] = holders.slice(0, 25).map(([address, v]) => ({
    address,
    balance: v.toString(),
    pctSupply: supplyNum > 0 ? (Number(v) / supplyNum) * 100 : 0,
  }));

  return {
    source: "chain",
    fetchedAt: new Date().toISOString(),
    holderCount: holders.length,
    hasMore: false,
    topHolders,
    top10Pct: topHolders.slice(0, 10).reduce((s, h) => s + h.pctSupply, 0),
  };
}

export async function fetchHolders(
  tokenAddress: string,
  totalSupply: string | null,
  createdBlock: string | null = null,
): Promise<HoldersSnapshot | null> {
  const key = tokenAddress.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < (hit.data ? TTL_MS : NEGATIVE_TTL_MS)) return hit.data;

  let data: HoldersSnapshot | null = null;
  try {
    data = await holdersFromBlockscout(key, totalSupply);
  } catch {
    try {
      data = await holdersFromChain(key, createdBlock);
    } catch {
      data = null;
    }
  }
  cache.set(key, { data, at: Date.now() });
  return data;
}
