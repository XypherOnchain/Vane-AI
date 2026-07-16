-- Expand project graph for Workspace Screen 1 + deployments / env names

ALTER TABLE projects ADD COLUMN IF NOT EXISTS default_branch TEXT DEFAULT 'main';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS chain_configs JSONB NOT NULL DEFAULT '[]';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS env_var_names JSONB NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS project_deployments (
  id               TEXT PRIMARY KEY,
  project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  chain_id         INTEGER NOT NULL,
  contract_address TEXT NOT NULL,
  tx_hash          TEXT,
  label            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deployments_project ON project_deployments (project_id, created_at DESC);

ALTER TABLE incidents ADD COLUMN IF NOT EXISTS test_sketch TEXT;
