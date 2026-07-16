# Vane AI — Product Framework

**Tagline:** Cursor helps you write code. Vane AI helps you build, test, debug and safely operate everything on-chain.

**Lead message:** A downloadable, crypto-native AI development environment — Code—OSS IDE first, with local wallet isolation and Telegram as a remote control.

**Architecture decision:** [`architecture/ADR-001-desktop-ide-primary.md`](./architecture/ADR-001-desktop-ide-primary.md)

**Build track:** [`DESKTOP_IDE.md`](./DESKTOP_IDE.md) (Code—OSS) · legacy Debug checklist [`BUILD_PLAN.md`](./BUILD_PLAN.md)

## Positioning

Vane is a **crypto-native AI IDE**, not a browser dashboard with a chat box and not a trading radar.

| Tool | Understands |
|------|-------------|
| Cursor / VS Code | Software repositories |
| **Vane** | Repos + contracts + wallets + txs + deployments + irreversible risk |

## Surfaces (priority order)

1. **Desktop IDE** (primary) — branded Code—OSS at `apps/desktop-ide` (submodule). **Vane Home** is the first screen; Agent + Project overview for builders of all levels; editor/terminal/Git stay available when needed.
2. **Web** (secondary) — marketing + Debug dogfood at `/debug/*`. Never holds private keys.
3. **Legacy Electron shell** (`apps/desktop`) — temporary wrapper around the Next Debug UI until the IDE boots.
4. **Telegram** — alerts and deep links only (never raw keys or chat-as-signature for meaningful value).

## Non-negotiables

- Desktop-first; local-first wallet security
- Propose → validate → policy → simulate → human approve → local sign
- AI cannot enable Live mode
- No funds to unverified generated wallets (enforced in walletd, later phases)

## Legacy Debug (secondary)

The Next.js Debug loop (workspace, tx inspect, repair, memory) remains available for dogfooding until those flows land in the IDE. See [`ACCEPTANCE_P1.md`](./ACCEPTANCE_P1.md).

## Related architecture docs

- [Reusable module inventory](./architecture/reusable-module-inventory.md)
- [Security boundaries](./architecture/security-boundaries.md)
- [Code—OSS upstream notes](./architecture/code-oss-upstream.md)
