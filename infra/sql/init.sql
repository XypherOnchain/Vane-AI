-- Vane AI primary schema (PostgreSQL graph model)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS tokens (
  address            TEXT PRIMARY KEY,
  chain_id           INTEGER NOT NULL DEFAULT 4663,
  name               TEXT,
  symbol             TEXT,
  decimals           INTEGER DEFAULT 18,
  deployer           TEXT,
  created_at_block   BIGINT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  total_supply       NUMERIC,
  price_usd          NUMERIC,
  market_cap_usd     NUMERIC,
  fdv_usd            NUMERIC,
  liquidity_usd      NUMERIC,
  volume_usd         NUMERIC,
  buys_1h            INTEGER DEFAULT 0,
  sells_1h           INTEGER DEFAULT 0,
  holders            INTEGER DEFAULT 0,
  unique_buyers      INTEGER DEFAULT 0,
  ath_fdv_usd        NUMERIC,
  ath_at             TIMESTAMPTZ,
  vane_score         INTEGER,
  connected_supply_pct NUMERIC,
  metadata           JSONB DEFAULT '{}'::jsonb,
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallets (
  address            TEXT PRIMARY KEY,
  chain_id           INTEGER NOT NULL DEFAULT 4663,
  first_seen_at      TIMESTAMPTZ,
  funding_origin     TEXT,
  label              TEXT,
  dna_class          TEXT,
  win_rate           NUMERIC,
  realized_pnl_usd   NUMERIC,
  unrealized_pnl_usd NUMERIC,
  median_entry_mins  NUMERIC,
  median_hold_mins   NUMERIC,
  metadata           JSONB DEFAULT '{}'::jsonb,
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_holders (
  token_address      TEXT NOT NULL REFERENCES tokens(address) ON DELETE CASCADE,
  wallet_address     TEXT NOT NULL,
  balance            NUMERIC NOT NULL DEFAULT 0,
  pct_supply         NUMERIC,
  is_contract        BOOLEAN DEFAULT FALSE,
  is_lp              BOOLEAN DEFAULT FALSE,
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (token_address, wallet_address)
);

CREATE TABLE IF NOT EXISTS wallet_edges (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address      TEXT,
  from_wallet        TEXT NOT NULL,
  to_wallet          TEXT NOT NULL,
  relation           TEXT NOT NULL,
  confidence         NUMERIC NOT NULL DEFAULT 0,
  evidence           JSONB DEFAULT '[]'::jsonb,
  confirmed          BOOLEAN DEFAULT FALSE,
  observed_at        TIMESTAMPTZ DEFAULT NOW(),
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_edges_token ON wallet_edges(token_address);
CREATE INDEX IF NOT EXISTS idx_wallet_edges_from ON wallet_edges(from_wallet);
CREATE INDEX IF NOT EXISTS idx_wallet_edges_to ON wallet_edges(to_wallet);

CREATE TABLE IF NOT EXISTS clusters (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address      TEXT NOT NULL,
  confidence         NUMERIC NOT NULL,
  supply_pct         NUMERIC,
  wallet_count       INTEGER,
  signals            JSONB DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS score_breakdowns (
  token_address      TEXT PRIMARY KEY REFERENCES tokens(address) ON DELETE CASCADE,
  total              INTEGER NOT NULL,
  contract_integrity INTEGER,
  distribution       INTEGER,
  developer_history  INTEGER,
  liquidity_quality  INTEGER,
  market_integrity   INTEGER,
  wallet_quality     INTEGER,
  momentum           INTEGER,
  social             INTEGER,
  evidence           JSONB DEFAULT '{}'::jsonb,
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_ref           TEXT,
  telegram_chat_id   TEXT,
  token_address      TEXT,
  kind               TEXT NOT NULL,
  rules              JSONB DEFAULT '{}'::jsonb,
  active             BOOLEAN DEFAULT TRUE,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address      TEXT NOT NULL,
  summary            TEXT,
  payload            JSONB NOT NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS indexer_state (
  key                TEXT PRIMARY KEY,
  value              TEXT NOT NULL,
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS radar_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind               TEXT NOT NULL,
  token_address      TEXT,
  payload            JSONB DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_radar_created ON radar_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_updated ON tokens(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_mcap ON tokens(market_cap_usd DESC NULLS LAST);
