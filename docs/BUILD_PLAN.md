# Vane AI — Build Plan Checklist

Product identity: [`PRODUCT.md`](./PRODUCT.md) · Primary architecture: [`architecture/ADR-001-desktop-ide-primary.md`](./architecture/ADR-001-desktop-ide-primary.md)

## Active track — Code—OSS IDE

| Phase | Focus | Status |
|-------|--------|--------|
| 0 | Reframe: ADR, inventory, demote web-as-primary | Done (`phase/00-01-code-oss-foundation`) |
| 1 | Branded Code—OSS shell + Vane views | Done — submodule + `vane-workbench` + smoke |
| 2 | Agent foundation (models, tools, redaction) | Pending |
| 3 | Crypto project intelligence | Pending |
| 4 | Local Anvil / tx debug in IDE | Pending |
| 5 | Wallet vault (`vane-walletd`) | Pending |
| 6 | Transaction engine | Pending |
| 7+ | Deploy / swap / bridge / Telegram / Live | Pending |

IDE runbook: [`DESKTOP_IDE.md`](./DESKTOP_IDE.md)

## Legacy track — Next.js Debug (secondary dogfood)

Completed scaffolding under `/debug/*` + API. Not the primary product.

- [x] Debug workspace, inspector, repair, tool chat, Telegram alerts, Electron legacy shell
- [x] Packages: project-graph, repo-index, simulation, policy, workflow

Do **not** grow the web dashboard as the main Vane experience. Port capabilities into the IDE.
