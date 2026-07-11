-- Pools discovered from DEX factory events (required by launchpad/DEX ingestion)

CREATE TABLE IF NOT EXISTS pools (
  chain_id       INTEGER NOT NULL,
  address        TEXT NOT NULL,
  dex_id         TEXT NOT NULL,
  token0         TEXT NOT NULL,
  token1         TEXT NOT NULL,
  fee_ppm        INTEGER,
  tick_spacing   INTEGER,
  created_block  BIGINT NOT NULL,
  created_tx     TEXT NOT NULL,
  launchpad_id   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain_id, address)
);

CREATE INDEX IF NOT EXISTS idx_pools_token0 ON pools (chain_id, token0);
CREATE INDEX IF NOT EXISTS idx_pools_token1 ON pools (chain_id, token1);
CREATE INDEX IF NOT EXISTS idx_pools_created ON pools (chain_id, created_block DESC);
