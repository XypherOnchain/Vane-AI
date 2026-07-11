-- Real on-chain launch time. created_at is the DB insert time (useless for age
-- during backfill); launched_at is the block timestamp of the creation event.

ALTER TABLE tokens ADD COLUMN IF NOT EXISTS launched_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tokens_launched ON tokens (chain_id, launched_at DESC);
