import type { RadarCard } from "@vane/shared-types";
import { getPool } from "./db.js";

/**
 * Reads REAL indexed launches from Postgres (populated by the indexer's
 * integrations watcher). Market, holder, contract, and graph intelligence are
 * not computed yet, so those fields are zeroed and marked pending — Vane shows
 * partial truth, never invented numbers.
 */

interface TokenRow {
  address: string;
  name: string | null;
  symbol: string | null;
  launchpad_id: string | null;
  deployer_address: string | null;
  created_block: string | null;
  created_at: Date;
  processing_state: string;
  pool_count: string;
}

function toRadarCard(row: TokenRow): RadarCard {
  const ageMinutes = Math.max(0, Math.round((Date.now() - row.created_at.getTime()) / 60_000));
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
    ageMinutes,
    connectedSupplyPct: 0,
    integrityScore: 0,
    momentumScore: 0,
    launchpad: row.launchpad_id ?? undefined,
    status: "new",
    processingState: "MARKET_PENDING",
    alerts: [],
    developerStatus: "unknown",
    dataReady: { market: false, holders: false, contract: false, graph: false },
  };
}

export async function listIndexedRadar(limit = 100): Promise<RadarCard[] | null> {
  const pool = getPool();
  if (!pool) return null;
  try {
    const r = await pool.query<TokenRow>(
      `SELECT t.address, t.name, t.symbol, t.launchpad_id, t.deployer_address,
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
    return r.rows.map(toRadarCard);
  } catch {
    // Table missing or DB down — callers report not_indexed / readiness fails.
    return null;
  }
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
