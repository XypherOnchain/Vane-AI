# Vane AI

**The intelligence layer for Robinhood Chain.**

Repo: [XypherOnchain/Vane-AI](https://github.com/XypherOnchain/Vane-AI)

## Project status — honest assessment

Vane is currently a **prototype foundation**, not a live intelligence platform. The
monorepo, web surfaces, API skeleton, and early indexer exist; production indexing,
DEX/launchpad decoding, holder accounting, graph evidence, contract scanning,
evidence-backed AI, and the Telegram bots are still being built (see the completion
plan, PR2 onward).

### Truthfulness rules (enforced in code)

- `VANE_DEMO_MODE` defaults to **false**. Simulated data only loads when it is
  deliberately enabled, and every demo payload is marked `dataSource: "demo"`.
- Production **refuses to start** with demo mode enabled, with missing critical
  environment variables, or with the rate-limited public Robinhood RPC as a provider.
- When data is not indexed, the API returns `not_indexed` — it never substitutes
  simulated findings.

## Quick start (from the repository root, any folder)

```bash
cp .env.example .env    # add secrets; set VANE_DEMO_MODE=true to explore with demo data
pnpm install
pnpm db:up              # Postgres + Redis (Docker)
pnpm dev:web            # API + Next.js
```

- Web: http://localhost:3000
- API liveness: http://localhost:4000/health/live
- API readiness: http://localhost:4000/health/ready (503 until Postgres, Redis, and RPC are reachable)

## Validation

Every workspace has real commands — no placeholder scripts:

```bash
pnpm lint        # ESLint across all apps and packages
pnpm typecheck   # tsc --noEmit everywhere
pnpm test        # vitest (config, shared-types, telegram formatting, API gating)
pnpm build       # production builds
```

## Architecture

```text
apps/
├── web                     # Next.js product UI
├── api                     # shared REST API (also serves both bots later)
├── indexer                 # Robinhood Chain ingestion (v2 pipeline lands in PR3)
├── worker                  # background jobs (stub)
├── telegram-pairs          # New Pairs bot (stub)
├── telegram-intelligence   # Intelligence bot (stub)
└── admin                   # operations app (stub)

packages/
├── config                  # env schema + strict production validation
├── shared-types            # canonical shared types (single source of truth)
├── chain                   # Robinhood Chain config + RPC provider w/ failover
├── telegram                # reusable Telegram formatting (extracted from legacy bot)
├── database, dex-adapters, launchpad-adapters, contract-scanner,
│   graph-engine, intelligence, scoring, alerts, ai, validation,
│   observability, ui       # contracts defined, implementations land per plan
```

The legacy `apps/bot` was removed; its reusable formatting logic now lives in
`packages/telegram`. The duplicate `packages/shared` shim and `infra/` SQL
directory were removed — `packages/shared-types` and `infrastructure/sql` are
canonical.

## Live integrations (Robinhood Chain, chain ID 4663)

Protocol addresses live in the versioned registry at
`packages/chain/src/integrations.ts` — never scattered through code. Every
enabled address was bytecode-verified on-chain on 2026-07-10.

| Integration          | Status                                                | Contracts                                   |
| -------------------- | ----------------------------------------------------- | ------------------------------------------- |
| NOXA Fun (launchpad) | **live** — launches decoded from LaunchFactory events | `0xD9eC…FCcB` factory, `0x7F03…cD85` locker |
| Uniswap V3 (DEX)     | **live** — PoolCreated/Swap/Mint/Burn decoding        | `0x1f7d…2EfA` factory                       |
| Uniswap V2 / V4      | registered, disabled (adapters pending)               | verified addresses in registry              |
| hood.fun (launchpad) | registered, **disabled** — no published addresses yet | none                                        |
| Rialto (PropAMM)     | registered, disabled — addresses unpublished          | none                                        |

The indexer's integrations watcher backfills and tails these contracts,
persisting real launches into `tokens` and `pools`. The API serves them on
`/v1/radar` with honest `MARKET_PENDING` states until the pricing pipeline
lands. Adapter decoders are tested against real captured mainnet logs
(`packages/dex-adapters/src/fixtures.ts`).

## Environment

See `.env.example` for the full list. Required in production (startup fails without them):

```text
DATABASE_URL, REDIS_URL,
ROBINHOOD_RPC_PRIMARY, ROBINHOOD_RPC_BACKUP,
CORS_ORIGINS, INTERNAL_API_SECRET, AUTH_SECRET
```

## Docs

- [Adding DEX / launchpad adapters](docs/adapters.md)
