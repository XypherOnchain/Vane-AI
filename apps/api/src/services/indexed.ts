import type {
  GraphEdge,
  GraphNode,
  RadarCard,
  SearchResult,
  TokenOverview,
  WalletDna,
} from "@vane/shared-types";
import { getPool } from "./db.js";
import { fetchTokenMarket, type TokenMarketData } from "./market.js";

/**
 * Real intelligence built from indexed chain data (Postgres, populated by the
 * indexer's integrations watcher) plus live market data (GeckoTerminal's
 * robinhood network). Every number here traces to a real source; anything not
 * yet computed is zeroed and marked pending — Vane shows partial truth, never
 * invented numbers.
 */

interface TokenRow {
  address: string;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  launchpad_id: string | null;
  deployer_address: string | null;
  created_block: string | null;
  created_at: Date;
  processing_state: string;
}

interface PoolRow {
  address: string;
  dex_id: string;
  token0: string;
  token1: string;
  fee_ppm: number | null;
  created_block: string;
}

interface SiblingRow {
  address: string;
  name: string | null;
  symbol: string | null;
  created_at: Date;
}

function ageMinutesOf(createdAt: Date): number {
  return Math.max(0, Math.round((Date.now() - createdAt.getTime()) / 60_000));
}

// ── Radar ────────────────────────────────────────────────────────────────

function toRadarCard(row: TokenRow & { pool_count: string }): RadarCard {
  return {
    dataSource: "indexed",
    address: row.address,
    name: row.name ?? "Unknown",
    symbol: row.symbol ?? "???",
    marketCapUsd: 0,
    liquidityUsd: 0,
    volume1hUsd: 0,
    buys1h: 0,
    sells1h: 0,
    uniqueBuyers: 0,
    holders: 0,
    ageMinutes: ageMinutesOf(row.created_at),
    connectedSupplyPct: 0,
    integrityScore: 0,
    momentumScore: 0,
    launchpad: row.launchpad_id ?? undefined,
    status: "new",
    processingState: "MARKET_PENDING",
    alerts: [],
    developerStatus: "unknown",
    dataReady: { market: false, holders: false, contract: false, graph: true },
  };
}

export async function listIndexedRadar(limit = 100): Promise<RadarCard[] | null> {
  const pool = getPool();
  if (!pool) return null;
  try {
    const r = await pool.query<TokenRow & { pool_count: string }>(
      `SELECT t.address, t.name, t.symbol, t.decimals, t.launchpad_id, t.deployer_address,
              t.created_block, t.created_at, t.processing_state,
              COUNT(p.address)::text AS pool_count
       FROM tokens t
       LEFT JOIN pools p ON p.chain_id = t.chain_id
         AND (p.token0 = t.address OR p.token1 = t.address)
       WHERE t.launchpad_id IS NOT NULL OR t.processing_state <> 'DETECTED'
       GROUP BY t.chain_id, t.address
       ORDER BY t.created_block DESC NULLS LAST, t.created_at DESC
       LIMIT $1`,
      [limit],
    );
    const cards = r.rows.map(toRadarCard);
    await enrichRadarWithMarket(cards, 10);
    return cards;
  } catch {
    // Table missing or DB down — callers report not_indexed / readiness fails.
    return null;
  }
}

/**
 * Fill live market metrics for the newest cards. Fetches are cached (30s per
 * token) and bounded so a radar refresh never exceeds GeckoTerminal's free
 * rate limit. Tokens without market coverage stay honestly at zero/pending.
 */
async function enrichRadarWithMarket(cards: RadarCard[], topN: number): Promise<void> {
  const targets = cards.slice(0, topN);
  await Promise.allSettled(
    targets.map(async (card) => {
      const m = await fetchTokenMarket(card.address);
      if (!m) return;
      card.marketCapUsd = m.marketCapUsd;
      card.liquidityUsd = m.liquidityUsd;
      card.processingState = "MARKET_READY";
      card.dataReady.market = true;
    }),
  );
}

export async function countIndexedTokens(): Promise<number> {
  const pool = getPool();
  if (!pool) return 0;
  try {
    const r = await pool.query(`SELECT COUNT(*)::int AS n FROM tokens`);
    return r.rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

// ── Token overview ───────────────────────────────────────────────────────

async function tokenRow(address: string): Promise<TokenRow | null> {
  const pool = getPool();
  if (!pool) return null;
  try {
    const r = await pool.query<TokenRow>(
      `SELECT address, name, symbol, decimals, launchpad_id, deployer_address,
              created_block, created_at, processing_state
       FROM tokens WHERE address = $1 LIMIT 1`,
      [address.toLowerCase()],
    );
    return r.rows[0] ?? null;
  } catch {
    return null;
  }
}

async function poolsFor(address: string): Promise<PoolRow[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const r = await pool.query<PoolRow>(
      `SELECT address, dex_id, token0, token1, fee_ppm, created_block::text
       FROM pools WHERE token0 = $1 OR token1 = $1
       ORDER BY created_block ASC LIMIT 10`,
      [address.toLowerCase()],
    );
    return r.rows;
  } catch {
    return [];
  }
}

/** Other launches by the same deployer — the serial-launch signal. */
async function siblingLaunches(deployer: string, exclude: string): Promise<SiblingRow[]> {
  const pool = getPool();
  if (!pool) return [];
  try {
    const r = await pool.query<SiblingRow>(
      `SELECT address, name, symbol, created_at
       FROM tokens WHERE deployer_address = $1 AND address <> $2
       ORDER BY created_at DESC LIMIT 25`,
      [deployer.toLowerCase(), exclude.toLowerCase()],
    );
    return r.rows;
  } catch {
    return [];
  }
}

export async function getIndexedTokenOverview(address: string): Promise<TokenOverview | null> {
  const row = await tokenRow(address);
  if (!row) return null;

  const [market, siblings] = await Promise.all([
    fetchTokenMarket(row.address),
    row.deployer_address ? siblingLaunches(row.deployer_address, row.address) : [],
  ]);

  const launchCount = siblings.length + 1;
  const serial = launchCount >= 3;
  const warnings: TokenOverview["warnings"] = [];
  if (serial) {
    warnings.push({
      text: `Deployer has launched ${launchCount} tokens on Robinhood Chain — serial launcher`,
      href: `/wallet/${row.deployer_address}`,
      severity: launchCount >= 8 ? "critical" : "high",
    });
  }

  const evidence: string[] = [
    `Launch indexed from on-chain ${row.launchpad_id ?? "factory"} events (block ${row.created_block ?? "?"})`,
  ];
  if (row.deployer_address) evidence.push(`Deployer ${row.deployer_address}: ${launchCount} known launches`);
  if (market) evidence.push(`Market data: GeckoTerminal robinhood network at ${market.fetchedAt}`);

  // Partial deterministic integrity: only the developer-history component is
  // computable today; the rest are 0 with confidence marked low.
  const developerHistory = row.deployer_address
    ? Math.max(0, 25 - Math.min(25, (launchCount - 1) * 4))
    : 0;

  const summaryParts = [
    `${row.name ?? "Unknown"} ($${row.symbol ?? "???"}) launched via ${row.launchpad_id ?? "an unregistered factory"} ${describeAge(ageMinutesOf(row.created_at))}.`,
  ];
  if (row.deployer_address) {
    summaryParts.push(
      serial
        ? `The deployer is a serial launcher with ${launchCount} known tokens — treat with caution.`
        : `This is the deployer's ${launchCount === 1 ? "only known launch" : `one of ${launchCount} known launches`}.`,
    );
  }
  summaryParts.push(
    market
      ? `Live market: ${usd(market.marketCapUsd)} market cap, ${usd(market.liquidityUsd)} liquidity, ${usd(market.volume24hUsd)} 24h volume.`
      : `No market coverage yet — the token may be too new or too small for price aggregators.`,
  );

  return {
    dataSource: "indexed",
    address: row.address,
    chainId: 4663,
    name: row.name ?? "Unknown",
    symbol: row.symbol ?? "???",
    decimals: row.decimals ?? 18,
    priceUsd: market?.priceUsd ?? 0,
    marketCapUsd: market?.marketCapUsd ?? 0,
    fdvUsd: market?.fdvUsd ?? 0,
    liquidityUsd: market?.liquidityUsd ?? 0,
    volume1hUsd: 0,
    volume24hUsd: market?.volume24hUsd ?? 0,
    buys1h: 0,
    sells1h: 0,
    holders: 0,
    uniqueBuyers: 0,
    ageMinutes: ageMinutesOf(row.created_at),
    athFdvUsd: 0,
    athMinutesAgo: null,
    deployer: row.deployer_address ?? "",
    launchpad: row.launchpad_id ?? undefined,
    processingState: market ? "MARKET_READY" : "MARKET_PENDING",
    topHolders: [],
    connectedSupplyPct: 0,
    confirmedConnectedSupplyPct: 0,
    probableConnectedSupplyPct: 0,
    freshWalletPct: 0,
    integrity: {
      total: developerHistory,
      contractSafety: 0,
      distributionQuality: 0,
      liquidityQuality: 0,
      developerHistory,
      marketIntegrity: 0,
      version: "v0-partial",
      evidence: { developerHistory: evidence },
    },
    momentum: {
      total: market && market.priceChange24hPct > 0 ? Math.min(100, Math.round(market.priceChange24hPct)) : 0,
      version: "v0-partial",
      evidence: market ? [`24h price change ${market.priceChange24hPct.toFixed(1)}% (GeckoTerminal)`] : [],
    },
    dataConfidence: {
      level: market ? "medium" : "low",
      score: market ? 55 : 30,
      reasons: [
        "Launch + deployer facts are indexed from chain",
        market ? "Market data live from GeckoTerminal" : "No market coverage yet",
        "Holder, contract-scan, and cluster analysis pending",
      ],
    },
    cluster: null,
    findings: [],
    summary: summaryParts.join(" "),
    summaryEvidenceIds: [],
    warnings,
  };
}

function usd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function describeAge(minutes: number): string {
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / (24 * 60))}d ago`;
}

// ── Graph ────────────────────────────────────────────────────────────────

/**
 * Real relationship graph from indexed facts: deployer → token (deployment),
 * token → pools (liquidity), deployer → sibling launches (serial pattern).
 * No probabilistic clustering yet — every edge here is a confirmed on-chain fact.
 */
export async function getIndexedGraph(
  address: string,
): Promise<{ dataSource: "indexed"; nodes: GraphNode[]; edges: GraphEdge[] } | null> {
  const row = await tokenRow(address);
  if (!row) return null;
  const [pools, siblings] = await Promise.all([
    poolsFor(row.address),
    row.deployer_address ? siblingLaunches(row.deployer_address, row.address) : [],
  ]);

  const nodes: GraphNode[] = [
    {
      id: row.address,
      address: row.address,
      size: 46,
      category: "contract",
      label: `$${row.symbol ?? "???"}`,
    },
  ];
  const edges: GraphEdge[] = [];

  if (row.deployer_address) {
    nodes.push({
      id: row.deployer_address,
      address: row.deployer_address,
      size: 40,
      category: "deployer",
      label: "Deployer",
    });
    edges.push({
      id: `deploy-${row.address}`,
      from: row.deployer_address,
      to: row.address,
      relation: "deployed",
      confidence: 1,
      confirmed: true,
      why: `Creator recorded in ${row.launchpad_id ?? "factory"} launch event at block ${row.created_block ?? "?"}`,
      evidenceIds: [],
    });
  }

  for (const p of pools) {
    nodes.push({
      id: p.address,
      address: p.address,
      size: 30,
      category: "liquidity_pool",
      label: `${p.dex_id} pool${p.fee_ppm ? ` ${p.fee_ppm / 10_000}%` : ""}`,
    });
    edges.push({
      id: `pool-${p.address}`,
      from: row.address,
      to: p.address,
      relation: "liquidity_pool",
      confidence: 1,
      confirmed: true,
      why: `PoolCreated event on ${p.dex_id} at block ${p.created_block}`,
      evidenceIds: [],
    });
  }

  for (const s of siblings.slice(0, 12)) {
    nodes.push({
      id: s.address,
      address: s.address,
      size: 20,
      category: "deployer_linked",
      label: `$${s.symbol ?? "???"}`,
    });
    if (row.deployer_address) {
      edges.push({
        id: `sibling-${s.address}`,
        from: row.deployer_address,
        to: s.address,
        relation: "deployed",
        confidence: 1,
        confirmed: true,
        why: "Same deployer wallet — serial launch",
        evidenceIds: [],
      });
    }
  }

  return { dataSource: "indexed", nodes, edges };
}

// ── Wallet intel ─────────────────────────────────────────────────────────

/**
 * Deployer profile from indexed launches. Trading PnL analytics require the
 * full transfer index (pending), so those fields stay zero; what IS real is
 * the launch history — the core sniper-bot "serial launcher" signal.
 */
export async function getIndexedWallet(address: string): Promise<WalletDna | null> {
  const pool = getPool();
  if (!pool) return null;
  try {
    const r = await pool.query<SiblingRow>(
      `SELECT address, name, symbol, created_at
       FROM tokens WHERE deployer_address = $1
       ORDER BY created_at DESC LIMIT 50`,
      [address.toLowerCase()],
    );
    if (r.rows.length === 0) return null;
    const launches = r.rows;
    const newest = launches[0]!;
    const oldest = launches[launches.length - 1]!;
    const spanDays = Math.max(
      1,
      Math.round((newest.created_at.getTime() - oldest.created_at.getTime()) / 86_400_000),
    );
    const names = launches
      .filter((l) => l.symbol)
      .slice(0, 6)
      .map((l) => `$${l.symbol}`)
      .join(", ");
    return {
      dataSource: "indexed",
      address: address.toLowerCase(),
      dnaClass: launches.length >= 3 ? "serial_deployer" : "deployer",
      walletAgeDays: Math.round((Date.now() - oldest.created_at.getTime()) / 86_400_000),
      winRate: 0,
      realizedPnlUsd: 0,
      unrealizedPnlUsd: 0,
      medianEntryMinutes: 0,
      medianPositionEth: 0,
      medianHoldMinutes: 0,
      completedWins: 0,
      completedTotal: 0,
      associatedClusterSize: 0,
      recentBehaviorNote:
        `Deployed ${launches.length} token${launches.length === 1 ? "" : "s"} over ${spanDays} day${spanDays === 1 ? "" : "s"}` +
        (names ? ` — ${names}` : "") +
        ". Trading PnL analytics pending transfer index.",
    };
  } catch {
    return null;
  }
}

// ── Search ───────────────────────────────────────────────────────────────

export async function searchIndexed(q: string): Promise<SearchResult[]> {
  const pool = getPool();
  if (!pool) return [];
  const query = q.trim().toLowerCase().replace(/^\$/, "");
  if (!query) return [];
  try {
    if (/^0x[a-f0-9]{40}$/.test(query)) {
      const row = await tokenRow(query);
      const results: SearchResult[] = [];
      if (row) {
        results.push({
          type: "token",
          id: row.address,
          title: `$${row.symbol ?? "???"}`,
          subtitle: row.name ?? row.address,
        });
      }
      results.push({ type: "wallet", id: query, title: "Open as wallet", subtitle: query });
      return results;
    }
    const r = await pool.query<TokenRow>(
      `SELECT address, name, symbol, decimals, launchpad_id, deployer_address,
              created_block, created_at, processing_state
       FROM tokens
       WHERE LOWER(symbol) LIKE $1 OR LOWER(name) LIKE $1
       ORDER BY created_at DESC LIMIT 10`,
      [`%${query}%`],
    );
    return r.rows.map((t) => ({
      type: "token" as const,
      id: t.address,
      title: `$${t.symbol ?? "???"}`,
      subtitle: t.name ?? t.address,
    }));
  } catch {
    return [];
  }
}

export type { TokenMarketData };
