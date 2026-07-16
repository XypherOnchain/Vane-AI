# Vane AI

**Crypto-native AI workspace — Cursor for on-chain.**

> Debug transactions, understand contracts, build integrations and safely operate on-chain workflows from one AI environment — downloadable to your computer, with Telegram as a remote control.

Repo: [XypherOnchain/Vane-AI](https://github.com/XypherOnchain/Vane-AI)

Product framework: [`docs/PRODUCT.md`](./docs/PRODUCT.md)

## What we're building

| Surface | Role |
|---------|------|
| **Desktop app** (`apps/desktop`) | Downloadable Electron app (like Cursor) |
| **Web** (`apps/web`) | Same Debug UI in the browser |
| **API + indexer** | Chain intel, tx inspection, project memory |
| **Telegram** | Alerts + deep links (`vane://…`) — never private keys |

### Phase 1 — Vane Debug (shipping now)

1. **Workspace** — project, repo path, watch-only wallets, Telegram chat  
2. **AI chat** — paste a tx hash or ask a question  
3. **Tx Inspector** — receipt, logs, revert, risks from real RPC  
4. **Repair** — proposed patch + test sketch + simulation gate  
5. **Project memory** — incidents + audit log  

Later: Build (IDE/extension) → Flow (workflows) → Operate → Agent (policy-constrained).

## Quick start

```bash
cp .env.example .env
pnpm install
pnpm db:up              # optional Postgres + Redis
pnpm dev:web            # API :4000 + Next.js :3000
```

Open Debug in the browser: [http://localhost:3000/debug](http://localhost:3000/debug)

### Desktop (the Cursor-like install)

With web+API already running:

```bash
pnpm desktop            # Electron window → Debug workspace
```

Build installers (`.dmg` / `.exe` / AppImage):

```bash
pnpm desktop:dist       # → apps/desktop/release/
```

Deep links from Telegram: `vane://debug/tx/<hash>`

## Truthfulness rules

- `VANE_DEMO_MODE` defaults to **false**. Demo payloads are always labeled.
- When data isn't indexed, APIs return `not_indexed` — never invented findings.
- Debug defaults to **simulation mode**; live broadcast is not available in Phase 1.

## Architecture

```text
apps/
├── desktop                 # Electron shell (downloadable)
├── web                     # Next.js — Debug + Radar intel
├── api                     # REST + /v1/debug/*
├── indexer                 # Robinhood Chain ingestion
├── telegram-*              # bots (stubs → Phase 1 alerts)
└── worker, admin

packages/
├── project-graph           # workspace + incidents + audit (Pillar E)
├── chain, dex-adapters, launchpad-adapters
├── shared-types, config, telegram, …
```

## Validation

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
