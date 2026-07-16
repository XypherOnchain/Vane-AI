-- Phase 1: crypto project memory (code-to-chain graph foundation)

CREATE TABLE IF NOT EXISTS projects (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  repo_path     TEXT,
  github_url    TEXT,
  chains        JSONB NOT NULL DEFAULT '[]',
  telegram_chat_id TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_wallets (
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  address       TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'watch', -- watch | deployer | treasury | operator | test
  label         TEXT,
  chain_id      INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, address)
);

CREATE TABLE IF NOT EXISTS project_contracts (
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  address       TEXT NOT NULL,
  chain_id      INTEGER NOT NULL,
  name          TEXT,
  abi_path      TEXT,
  deployment_tx TEXT,
  is_production BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, chain_id, address)
);

CREATE TABLE IF NOT EXISTS incidents (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tx_hash       TEXT,
  chain_id      INTEGER,
  title         TEXT NOT NULL,
  summary       TEXT,
  revert_reason TEXT,
  status        TEXT NOT NULL DEFAULT 'open', -- open | investigating | resolved
  related_code  JSONB NOT NULL DEFAULT '[]',
  proposed_patch TEXT,
  simulation    JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_project ON incidents (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_tx ON incidents (tx_hash);

CREATE TABLE IF NOT EXISTS audit_events (
  id            TEXT PRIMARY KEY,
  project_id    TEXT,
  kind          TEXT NOT NULL,
  mode          TEXT NOT NULL DEFAULT 'simulation', -- simulation | testnet | live
  payload       JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_project ON audit_events (project_id, created_at DESC);
