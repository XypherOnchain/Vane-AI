# Vane AI — Product Framework

**Tagline:** Cursor helps you write code. Vane AI helps you build, test, debug and safely operate everything on-chain.

**Lead message:** Debug transactions, understand contracts, build integrations and safely operate on-chain workflows from one AI workspace — downloadable to your computer, with Telegram as a remote control.

## Positioning

Vane is a **crypto-native AI development and operations environment**, not a generic trading assistant.

| Tool | Understands |
|------|-------------|
| Cursor | Software repositories |
| Nansen | Labeled wallets & research |
| AgentKit | Wallet actions |
| **Vane** | Repos + contracts + wallets + txs + DEXs + deployments + irreversible risk |

## Surfaces

1. **Desktop app** (primary) — Electron installable like Cursor (`.dmg` / `.exe` / AppImage)
2. **Web app** — same Debug UI in the browser for demos and light use
3. **Cursor / VS Code extension** (Phase 2) — same backend in the editor
4. **Telegram** — alerts, approvals, deep links back into Vane (never raw private keys)

## Five pillars

| Pillar | Name | Status |
|--------|------|--------|
| A | Crypto-native coding environment | Phase 2 |
| B | Transaction debugger & simulator | **Phase 1 (now)** |
| C | Workflow builder | Phase 3 |
| D | Wallet & key safety layer | Phase 1 (watch-only + policies) → Phase 4 |
| E | Crypto project memory (graph) | **Phase 1 foundation** |

## Phase roadmap

### Phase 1 — Vane Debug (current)

- Workspace: connect repo path, chain, RPC, watch-only wallets, Telegram
- AI chat: paste tx hash or ask a project question
- Transaction inspector: summary, assets, logs, revert, risks
- Repair: proposed patch + test + fork-sim gate (no live broadcast without approval)
- Project memory: contracts, addresses, deployments, incidents
- Telegram: failure alerts with “Open in Vane” deep links

### Phase 2 — Vane Build

Repository editing, protocol codegen, ABI-aware suggestions, deploy manifests, Cursor extension.

### Phase 3 — Vane Flow

Natural-language workflows, visual editor, checkpoints, simulation gates, human approval, Telegram control.

### Phase 4 — Vane Operate

Contract monitoring, treasury dashboards, team permissions, spending policies, audit logs.

### Phase 5 — Vane Agent

Policy-constrained autonomy only after the safety layer is proven.

## Non-negotiable safety rules

- No value to a newly created address until key persistence is verified
- Every generated wallet must pass encrypt/decrypt test
- Simulate every transaction when simulation is available
- Destination chain and address displayed separately
- Unlimited approvals → prominent warnings
- Private keys never enter ordinary AI prompts
- Sensitive values redacted from logs and chat
- Every action produces a structured audit record
- Live mode visibly different from testnet / simulation

## Desktop delivery

```text
apps/desktop/          Electron shell (this is the “Cursor install”)
  ├── main.ts          Window, tray, deep links (vane://), local API sidecar
  ├── preload.ts       Safe bridge to renderer
  └── electron-builder Packaging → .dmg / .exe / AppImage
```

Dev: `pnpm desktop` → opens Electron → loads Debug UI + local API.  
Ship: `pnpm desktop:dist` → installers in `apps/desktop/release/`.

## Monetization order

1. Developer subscriptions ($29–49)
2. Team subscriptions
3. Simulation / AI usage credits
4. API
5. Enterprise
6. Transparent routing fees (never hidden)
7. Token only after real utility (not at launch)
