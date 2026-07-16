# Vane Desktop IDE (Code-OSS)

Primary product surface per [ADR-001](./architecture/ADR-001-desktop-ide-primary.md).

## Layout

| Path | Role |
|------|------|
| `apps/desktop-ide/` | Git submodule → [XypherOnchain/vane-code-oss](https://github.com/XypherOnchain/vane-code-oss) |
| `scripts/desktop-ide/` | init / brand / dev / build / smoke |
| `apps/desktop/` | **LEGACY** Electron → Next.js Debug shell |

## Prerequisites

- Node.js **24** (match upstream Code-OSS `.nvmrc` when present; Homebrew `node@24` works)
- npm inside `apps/desktop-ide` (avoid Yarn from the monorepo root)
- Python 3 + build tools for native modules
- `git-lfs` installed (`brew install git-lfs && git lfs install`)

## Quick start

```bash
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
unset ELECTRON_RUN_AS_NODE
./scripts/desktop-ide/init.sh
./scripts/desktop-ide/brand.sh
./scripts/desktop-ide/smoke.sh
cd apps/desktop-ide
npx gulp compile-extension:vane-workbench
./scripts/code.sh
```

Or open `apps/desktop-ide/.build/electron/Vane AI.app`.

## Vane UI (Phase 3 — Home-first)

### Home (default first screen)

On launch you should see **Vane Home**, not the VS Code welcome page:

1. **Open project** or **New project**
2. **Ask Agent** (plain English)
3. **Wallets** / **Trade and launch** (clear "coming soon")
4. **Learn the basics**

Command Palette: **Vane: Open Home**

Stock VS Code Chat / secondary sidebar is demoted so **Vane Agent** is the AI surface.

### Agent

1. **Vane: Set Agent API Key**
2. Settings: `vane.agent.provider` (`openai`|`anthropic`), `vane.agent.model`
3. Rocket bar → **Agent**
4. Chat (`Cmd/Ctrl+Enter`). Writes and terminal always confirm.

### Project overview

Rocket bar → **Project**: detects Foundry / Hardhat / Solidity / Next-style folders, lists contracts/scripts, suggests next steps. Agent tool: `project_overview`.

### Status bar (human labels)

Provider/model · Agent · chain · **No wallet yet** · **Safe mode** · Vault locked

**Not yet:** vault, signing, swaps, bridges, Live execution, public downloadable installer.

## Acceptance checklist

- [ ] `./scripts/desktop-ide/smoke.sh` passes
- [ ] App launches titled **Vane AI**
- [ ] First screen is **Vane Home** (not VS Code Welcome)
- [ ] Open or create a project without needing Explorer first
- [ ] Agent + Project overview work; stock Chat is not required
- [ ] Status bar shows Safe mode / No wallet yet style labels
- [ ] No vault / signing in Agent

## Upstream merges

See [architecture/code-oss-upstream.md](./architecture/code-oss-upstream.md).
