# Vane AI

**Cursor for crypto** — a downloadable AI workspace to debug transactions, understand contracts, and safely operate on-chain workflows.

Repo: [XypherOnchain/Vane-AI](https://github.com/XypherOnchain/Vane-AI)  
Product framework: [`docs/PRODUCT.md`](./docs/PRODUCT.md)

## Phase 1 product (what ships)

| Screen | Path | Purpose |
|--------|------|---------|
| Workspace | `/debug` | Project, repo path, watch-only wallets, Telegram |
| AI Chat | `/debug/chat` | Paste a tx or ask a question |
| Tx Inspector | `/debug/tx` | Receipt, logs, revert, risks from RPC |
| Repair | `/debug/repair` | Patch + test + simulation gate (no live broadcast) |
| Memory | `/debug/memory` | Incidents + audit log |

Radar / new-pairs / trending / watchlists were **removed** from the product. Those URLs redirect to Debug. Matching API routes return `410 Gone`.

## Quick start

```bash
cp .env.example .env
pnpm install
pnpm dev:web            # API :4000 + Next.js :3000
pnpm desktop            # Electron window → Debug workspace
```

- Web: http://localhost:3000/debug  
- Desktop: `pnpm desktop` (loads Debug; deep links `vane://debug/tx/<hash>`)  
- Installers: `pnpm desktop:dist` → `apps/desktop/release/`

## API surface (Phase 1)

| Route | Role |
|-------|------|
| `/v1/debug/*` | Projects, wallets, contracts, tx inspect, incidents, Telegram alert payloads |
| `/v1/ai/query` | Chat (no private keys) |
| `/health/*` | Liveness / readiness |
| `/v1/radar`, `/v1/tokens/*`, … | **Retired** (`410`) |

## Safety defaults

- Simulation mode by default  
- Watch-only wallets  
- No live broadcast in Phase 1  
- Structured audit events for debug actions  

## Later phases

Build (IDE/extension) → Flow (workflows) → Operate → Agent — see `docs/PRODUCT.md`.
