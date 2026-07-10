# Vane AI

**The live intelligence network for Robinhood Chain.**

Repo: [XypherOnchain/Vane-AI](https://github.com/XypherOnchain/Vane-AI)

Paste any token, wallet, or transaction. Vane explains what is happening, shows the evidence, monitors what matters, and helps the trader act.

## Monorepo

```
apps/web       Next.js — marketing + Scan / Radar / Graph / Agent
apps/api       Intelligence API (rate-limited, cached)
apps/indexer   Robinhood Chain indexer (horizontal workers)
apps/bot       Telegram bot (Rick-density cards)
packages/shared  Shared types + formatters
packages/chain   Robinhood adapter (viem)
packages/ui      Design tokens
```

## Quick start

```bash
cp .env.example .env
# set TELEGRAM_BOT_TOKEN (and optional OPENAI_API_KEY, RPC_URL)

pnpm install
pnpm db:up          # Postgres + Redis (requires Docker)
pnpm dev            # web + api + bot + indexer
```

- Web: http://localhost:3000  
- API: http://localhost:4000/health  
- Telegram: message your bot, paste a contract  

## Launchable v1 surfaces

- Universal search, Radar, Token Scan, developer history
- Top holders, connected supply, shared-funder / same-block clusters
- Interactive graph + timeline scrub
- Explainable Vane Score, Wallet DNA, Ask Vane (tool-calling)
- Telegram scan cards, cluster/dev alerts, shareable reports (`/r/:id`)

## Scale (100k+)

- Redis cache on hot token scans (+ in-memory fallback)
- Express rate limiting + optional `API_KEY`
- Indexer sharded workers (`INDEXER_WORKERS`)
- Postgres schema + connection pooling
- `/health`, `/metrics`, `pnpm loadtest`

## Security

- No seed phrases / private keys on servers
- AI never signs — deterministic services own chain facts
- Secrets in `.env` only — never commit tokens
- Rotate any Telegram token that was shared in chat

## License

Proprietary — XypherOnchain / Vane
