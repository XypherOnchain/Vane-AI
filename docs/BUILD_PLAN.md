# Vane AI — Build Plan Checklist

Source of truth for implementation order. Product identity: [`PRODUCT.md`](./PRODUCT.md).

## Phase 1 — Vane Debug

- [x] P1.0 Source of truth + dead radar cleanup
- [x] P1.1 Project graph (Postgres) + Workspace Screen 1
- [x] P1.2 Full tx inspector (trace, ABI, gas, roles)
- [x] P1.3 Repo index + selector→source mapping
- [x] P1.4 Repair loop + Tenderly/Anvil fork sim
- [x] P1.5 Tool-calling AI chat + redaction
- [x] P1.6 Telegram Debug bot + `vane://` deep links
- [x] P1.7 Desktop sidecar + mode banners + dist
- [x] P1.8 Acceptance checklist green — [`ACCEPTANCE_P1.md`](./ACCEPTANCE_P1.md)

## Phase 2 — Vane Build

- [x] P2.1 Cursor/VS Code extension (`apps/vscode-extension`)
- [x] P2.2 Repo intelligence (ABI, templates, secrets)
- [x] P2.3 Deploy assist (simulate, approval-gated)

## Phase 3 — Vane Flow

- [x] P3.1 Workflow IR + runner (`@vane/workflow`)
- [x] P3.2 Visual editor + code view (`/flow`)
- [x] P3.3 External signing gate (WalletConnect path — no custody)
- [x] P3.4 Telegram approvals (open desktop, never chat-sign)

## Phase 4 — Vane Operate

- [x] P4.1 Treasury / inventory dashboards
- [x] P4.2 Contract monitoring
- [x] P4.3 Team roles + spending policies (`@vane/policy`)
- [x] P4.4 Local encrypted vault (desktop-only note + sidecar)
- [x] P4.5 Safe / hardware wallet integrations (status API)

## Phase 5 — Vane Agent

- [x] P5.1 Policy engine as hard constraints
- [x] P5.2 Session keys + limited autonomous jobs (`/v1/agent-jobs`)
- [x] P5.3 Human gate for high-value irreversible actions

## Defaults

- Robinhood Chain (4663) first; ETH/Base slots in workspace
- Tenderly when configured; else Anvil fork
- Watch-only keys in Phase 1; no server custody
- No trading / radar product surface
