-- Phase 0 foundation schema (Task 3)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS chains (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  chain_id        INTEGER NOT NULL UNIQUE,
  native_symbol  TEXT NOT NULL DEFAULT 'ETH',
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  finality_blocks INTEGER NOT NULL DEFAULT 20,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO chains (id, name, chain_id, native_symbol)
VALUES
  ('robinhood-mainnet', 'Robinhood Chain', 4663, 'ETH'),
  ('robinhood-testnet', 'Robinhood Chain Testnet', 46630, 'ETH')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS checkpoints (
  service_name          TEXT NOT NULL,
  chain_id              INTEGER NOT NULL,
  last_received_block   BIGINT NOT NULL DEFAULT 0,
  last_processed_block  BIGINT NOT NULL DEFAULT 0,
  last_finalized_block  BIGINT NOT NULL DEFAULT 0,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (service_name, chain_id)
);

CREATE TABLE IF NOT EXISTS blocks (
  chain_id      INTEGER NOT NULL,
  block_number  BIGINT NOT NULL,
  block_hash    TEXT NOT NULL,
  parent_hash   TEXT NOT NULL,
  timestamp     TIMESTAMPTZ NOT NULL,
  status        TEXT NOT NULL DEFAULT 'ingested',
  ingested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain_id, block_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_blocks_hash ON blocks (chain_id, block_hash);

CREATE TABLE IF NOT EXISTS transactions (
  chain_id            INTEGER NOT NULL,
  hash                TEXT NOT NULL,
  block_number        BIGINT NOT NULL,
  transaction_index   INTEGER NOT NULL,
  from_address        TEXT NOT NULL,
  to_address          TEXT,
  value               NUMERIC NOT NULL DEFAULT 0,
  input               TEXT,
  status              INTEGER,
  gas_used            NUMERIC,
  effective_gas_price NUMERIC,
  PRIMARY KEY (chain_id, hash)
);

CREATE INDEX IF NOT EXISTS idx_tx_block ON transactions (chain_id, block_number);

CREATE TABLE IF NOT EXISTS contracts (
  chain_id               INTEGER NOT NULL,
  address                TEXT NOT NULL,
  deployer_address       TEXT,
  creation_tx            TEXT,
  creation_block         BIGINT,
  bytecode_hash          TEXT,
  is_verified            BOOLEAN NOT NULL DEFAULT FALSE,
  is_proxy               BOOLEAN NOT NULL DEFAULT FALSE,
  implementation_address TEXT,
  contract_type          TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain_id, address)
);

CREATE TABLE IF NOT EXISTS tokens (
  chain_id         INTEGER NOT NULL,
  address          TEXT NOT NULL,
  name             TEXT,
  symbol           TEXT,
  decimals         INTEGER DEFAULT 18,
  total_supply     NUMERIC,
  metadata_uri     TEXT,
  logo_url         TEXT,
  deployer_address TEXT,
  launchpad_id     TEXT,
  created_block    BIGINT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processing_state TEXT NOT NULL DEFAULT 'DETECTED',
  PRIMARY KEY (chain_id, address)
);

CREATE TABLE IF NOT EXISTS transfers (
  chain_id     INTEGER NOT NULL,
  tx_hash      TEXT NOT NULL,
  log_index    INTEGER NOT NULL,
  token_address TEXT NOT NULL,
  from_address TEXT NOT NULL,
  to_address   TEXT NOT NULL,
  amount       NUMERIC NOT NULL,
  block_number BIGINT NOT NULL,
  timestamp    TIMESTAMPTZ,
  PRIMARY KEY (chain_id, tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_transfers_token ON transfers (chain_id, token_address, block_number);

CREATE TABLE IF NOT EXISTS token_balances (
  chain_id       INTEGER NOT NULL,
  token_address  TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  balance        NUMERIC NOT NULL DEFAULT 0,
  updated_block  BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (chain_id, token_address, wallet_address)
);

CREATE TABLE IF NOT EXISTS integrations (
  id                TEXT PRIMARY KEY,
  display_name      TEXT NOT NULL,
  integration_type  TEXT NOT NULL,
  chain_id          INTEGER NOT NULL,
  factory_addresses TEXT[] NOT NULL DEFAULT '{}',
  router_addresses  TEXT[] NOT NULL DEFAULT '{}',
  start_block       BIGINT NOT NULL DEFAULT 0,
  enabled           BOOLEAN NOT NULL DEFAULT FALSE,
  priority          INTEGER NOT NULL DEFAULT 100,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telegram_update_dedupe (
  bot_type   TEXT NOT NULL,
  update_id  BIGINT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bot_type, update_id)
);
