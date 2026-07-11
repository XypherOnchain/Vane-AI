import type pg from "pg";
import { erc20Abi, normalizeAddress, watchedAddresses, type RpcProvider } from "@vane/chain";
import { enabledDexAdapters, type ChainLog } from "@vane/dex-adapters";
import { enabledLaunchpadAdapters } from "@vane/launchpad-adapters";

/**
 * Watches registry-listed DEX factories and launchpads (NOXA LaunchFactory,
 * Uniswap V3 factory) and persists launches and pools. Runs with its own
 * checkpoint so it can trail the tip independently of the block indexer.
 */

const SERVICE = "integrations-watcher";
const RANGE = 2000n; // blocks per eth_getLogs call
const CONFIRMATIONS = 3n;

interface WatcherDeps {
  provider: RpcProvider;
  getPool: () => pg.Pool;
  pollMs: number;
  /** How far back to start on first run (0 = full history from block 0). */
  backfillBlocks?: bigint;
}

async function getCheckpoint(deps: WatcherDeps): Promise<bigint | null> {
  try {
    const r = await deps
      .getPool()
      .query(
        `SELECT last_processed_block FROM checkpoints WHERE service_name = $1 AND chain_id = $2`,
        [SERVICE, deps.provider.config.chainId],
      );
    if (r.rows[0]) return BigInt(r.rows[0].last_processed_block);
  } catch {
    /* schema not ready yet */
  }
  return null;
}

async function setCheckpoint(deps: WatcherDeps, block: bigint) {
  await deps.getPool().query(
    `INSERT INTO checkpoints(service_name, chain_id, last_received_block, last_processed_block, last_finalized_block, updated_at)
     VALUES($1,$2,$3,$3,$3,NOW())
     ON CONFLICT (service_name, chain_id) DO UPDATE SET
       last_received_block = EXCLUDED.last_received_block,
       last_processed_block = EXCLUDED.last_processed_block,
       updated_at = NOW()`,
    [SERVICE, deps.provider.config.chainId, block.toString()],
  );
}

/** Retry with backoff — the public RPC 429s aggressively under backfill load. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 400 * 2 ** i));
    }
  }
  throw lastErr;
}

async function readTokenMetadata(deps: WatcherDeps, address: `0x${string}`) {
  // One Multicall3 eth_call instead of four separate reads — 4x fewer requests
  // against the rate-limited public RPC, plus retry for transient 429s.
  try {
    const results = (await withRetry(() =>
      deps.provider.multicall({
        contracts: [
          { address, abi: erc20Abi, functionName: "name" },
          { address, abi: erc20Abi, functionName: "symbol" },
          { address, abi: erc20Abi, functionName: "decimals" },
          { address, abi: erc20Abi, functionName: "totalSupply" },
        ],
        allowFailure: true,
      }),
    )) as { status: "success" | "failure"; result?: unknown }[];
    return {
      name: results[0].status === "success" ? String(results[0].result) : null,
      symbol: results[1].status === "success" ? String(results[1].result) : null,
      decimals: results[2].status === "success" ? Number(results[2].result) : 18,
      totalSupply: results[3].status === "success" ? String(results[3].result) : null,
    };
  } catch {
    return { name: null, symbol: null, decimals: 18, totalSupply: null };
  }
}

/** Block timestamp lookup with a small LRU-ish cache (launches cluster in nearby blocks). */
const blockTsCache = new Map<string, Date>();
async function blockTimestamp(deps: WatcherDeps, blockNumber: bigint): Promise<Date | null> {
  const key = blockNumber.toString();
  const hit = blockTsCache.get(key);
  if (hit) return hit;
  try {
    const block = await withRetry(() => deps.provider.getBlock({ blockNumber }));
    const ts = new Date(Number(block.timestamp) * 1000);
    blockTsCache.set(key, ts);
    if (blockTsCache.size > 5_000) {
      for (const k of Array.from(blockTsCache.keys()).slice(0, 1_000)) blockTsCache.delete(k);
    }
    return ts;
  } catch {
    return null;
  }
}

async function upsertLaunchedToken(
  deps: WatcherDeps,
  args: {
    token: `0x${string}`;
    creator: `0x${string}`;
    launchpadId: string;
    blockNumber: bigint;
  },
) {
  const [meta, launchedAt] = await Promise.all([
    readTokenMetadata(deps, args.token),
    blockTimestamp(deps, args.blockNumber),
  ]);
  await deps.getPool().query(
    `INSERT INTO tokens(chain_id, address, name, symbol, decimals, total_supply, deployer_address, launchpad_id, created_block, launched_at, processing_state)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'METADATA_READY')
     ON CONFLICT (chain_id, address) DO UPDATE SET
       name = COALESCE(EXCLUDED.name, tokens.name),
       symbol = COALESCE(EXCLUDED.symbol, tokens.symbol),
       total_supply = COALESCE(EXCLUDED.total_supply, tokens.total_supply),
       launchpad_id = COALESCE(EXCLUDED.launchpad_id, tokens.launchpad_id),
       deployer_address = COALESCE(tokens.deployer_address, EXCLUDED.deployer_address),
       launched_at = COALESCE(EXCLUDED.launched_at, tokens.launched_at),
       processing_state = 'METADATA_READY'`,
    [
      deps.provider.config.chainId,
      normalizeAddress(args.token),
      meta.name,
      meta.symbol,
      meta.decimals,
      meta.totalSupply,
      normalizeAddress(args.creator),
      args.launchpadId,
      args.blockNumber.toString(),
      launchedAt,
    ],
  );
  return meta;
}

async function upsertPool(
  deps: WatcherDeps,
  args: {
    address: `0x${string}`;
    dexId: string;
    token0: `0x${string}`;
    token1: `0x${string}`;
    feePpm: number | null;
    tickSpacing: number | null;
    blockNumber: bigint;
    transactionHash: `0x${string}`;
    launchpadId?: string;
  },
) {
  await deps.getPool().query(
    `INSERT INTO pools(chain_id, address, dex_id, token0, token1, fee_ppm, tick_spacing, created_block, created_tx, launchpad_id)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (chain_id, address) DO UPDATE SET
       launchpad_id = COALESCE(pools.launchpad_id, EXCLUDED.launchpad_id)`,
    [
      deps.provider.config.chainId,
      normalizeAddress(args.address),
      args.dexId,
      normalizeAddress(args.token0),
      normalizeAddress(args.token1),
      args.feePpm,
      args.tickSpacing,
      args.blockNumber.toString(),
      args.transactionHash,
      args.launchpadId ?? null,
    ],
  );
}

/**
 * Metadata reads and block-timestamp lookups can fail transiently during
 * backfill (RPC throttling), leaving tokens with null name/symbol/launched_at.
 * Heal a batch every loop so the radar repairs itself instead of showing
 * "Unknown" and zero ages forever.
 */
async function repairMissingMetadata(deps: WatcherDeps): Promise<number> {
  const r = await deps.getPool().query<{ address: string; created_block: string | null }>(
    `SELECT address, created_block::text FROM tokens
     WHERE chain_id = $1 AND (name IS NULL OR symbol IS NULL OR launched_at IS NULL)
     ORDER BY created_block DESC NULLS LAST LIMIT 25`,
    [deps.provider.config.chainId],
  );
  let repaired = 0;
  for (const row of r.rows) {
    const [meta, launchedAt] = await Promise.all([
      readTokenMetadata(deps, row.address as `0x${string}`),
      row.created_block ? blockTimestamp(deps, BigInt(row.created_block)) : null,
    ]);
    if (meta.name == null && meta.symbol == null && launchedAt == null) continue;
    await deps.getPool().query(
      `UPDATE tokens SET name = COALESCE($3, name), symbol = COALESCE($4, symbol),
        decimals = $5, total_supply = COALESCE($6, total_supply),
        launched_at = COALESCE($7, launched_at)
       WHERE chain_id = $1 AND address = $2`,
      [
        deps.provider.config.chainId,
        row.address,
        meta.name,
        meta.symbol,
        meta.decimals,
        meta.totalSupply,
        launchedAt,
      ],
    );
    repaired += 1;
    // Gentle pacing so repair never competes with live ingestion for RPC quota.
    await new Promise((res) => setTimeout(res, 150));
  }
  return repaired;
}

async function processRange(deps: WatcherDeps, from: bigint, to: bigint): Promise<number> {
  const addresses = watchedAddresses();
  const dexAdapters = enabledDexAdapters();
  const launchpadAdapters = enabledLaunchpadAdapters();

  const rawLogs = await deps.provider.getLogs({
    address: addresses,
    fromBlock: from,
    toBlock: to,
  });

  let handled = 0;
  // Track pools created by launchpad launches within this range so pool rows
  // carry launchpad attribution even though the events are separate logs.
  const launchPools = new Map<string, string>(); // pool -> launchpadId

  const logs: ChainLog[] = rawLogs
    .filter((l) => l.blockNumber != null && l.transactionHash != null && l.logIndex != null)
    .map((l) => ({
      address: l.address as `0x${string}`,
      topics: l.topics as `0x${string}`[],
      data: l.data as `0x${string}`,
      blockNumber: l.blockNumber!,
      transactionHash: l.transactionHash as `0x${string}`,
      logIndex: Number(l.logIndex),
    }));

  // Launchpad events first (so pool attribution exists before pool upserts).
  for (const log of logs) {
    for (const adapter of launchpadAdapters) {
      const launched = adapter.decodeLaunchCompleted(log);
      if (launched) {
        launchPools.set(launched.pool.toLowerCase(), adapter.id);
        const meta = await upsertLaunchedToken(deps, {
          token: launched.token,
          creator: launched.creator,
          launchpadId: adapter.id,
          blockNumber: launched.blockNumber,
        });
        console.log(
          `[integrations] ${adapter.id} launch: ${meta.symbol ?? "?"} ${launched.token} pool=${launched.pool} block=${launched.blockNumber}`,
        );
        handled += 1;
      }
    }
  }

  for (const log of logs) {
    for (const adapter of dexAdapters) {
      const pool = adapter.decodePoolCreated(log);
      if (pool) {
        await upsertPool(deps, {
          address: pool.pool,
          dexId: adapter.id,
          token0: pool.token0,
          token1: pool.token1,
          feePpm: pool.feePpm,
          tickSpacing: pool.tickSpacing,
          blockNumber: pool.blockNumber,
          transactionHash: pool.transactionHash,
          launchpadId: launchPools.get(pool.pool.toLowerCase()),
        });
        handled += 1;
      }
    }
  }

  return handled;
}

export async function runIntegrationsWatcher(deps: WatcherDeps): Promise<never> {
  console.log(
    `[integrations] watching ${watchedAddresses().length} contracts (dex + launchpad registries)`,
  );
  for (;;) {
    try {
      const tip = await deps.provider.getBlockNumber();
      const safeTip = tip > CONFIRMATIONS ? tip - CONFIRMATIONS : 0n;
      const checkpoint = await getCheckpoint(deps);
      let cursor: bigint;
      if (checkpoint == null) {
        const backfill = deps.backfillBlocks ?? 50_000n;
        cursor = safeTip > backfill ? safeTip - backfill : 0n;
        console.log(`[integrations] no checkpoint — starting backfill at block ${cursor}`);
      } else {
        cursor = checkpoint;
      }
      while (cursor < safeTip) {
        const to = cursor + RANGE > safeTip ? safeTip : cursor + RANGE;
        const handled = await processRange(deps, cursor + 1n, to);
        await setCheckpoint(deps, to);
        if (handled > 0)
          console.log(`[integrations] blocks ${cursor + 1n}-${to}: ${handled} events`);
        cursor = to;
      }
    } catch (e) {
      console.warn(`[integrations] loop error`, (e as Error).message);
    }
    try {
      const repaired = await repairMissingMetadata(deps);
      if (repaired > 0) console.log(`[integrations] repaired metadata for ${repaired} tokens`);
    } catch {
      /* retried next loop */
    }
    await new Promise((r) => setTimeout(r, deps.pollMs));
  }
}
