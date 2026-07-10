# Vane AI

**The intelligence layer for Robinhood Chain.**

Repo: [XypherOnchain/Vane-AI](https://github.com/XypherOnchain/Vane-AI)

## Current focus

1. **Web app first** — landing, Radar, token scan, graph, Ask Vane  
2. Shared backend APIs  
3. Telegram bots deferred (stubs only) until intelligence is stable  

## Quick start

```bash
cd /Users/andrewjayyosi/CascadeProjects/Vane-AI
cp .env.example .env   # add secrets
pnpm install
pnpm db:up             # Postgres + Redis (Docker)
pnpm dev:web           # API + Next.js
```

- Web: http://localhost:3000  
- API health: http://localhost:4000/health  

## Architecture

See the complete build plan. Monorepo apps:

- `apps/web` — complete product UI  
- `apps/api` — shared REST API  
- `apps/indexer` — Robinhood Chain ingestion  
- `apps/worker` — background jobs (stub)  
- `apps/telegram-pairs` / `apps/telegram-intelligence` — stubs  

## Phase status

- Phase 0 foundations: in progress / local runnable  
- Web main surfaces: landing, radar, new-pairs, trending, token tabs, graph, wallet, ask  
- Telegram: deferred  

## Docs

- [Adding DEX / launchpad adapters](docs/adapters.md)
