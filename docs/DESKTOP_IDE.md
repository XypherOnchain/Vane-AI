# Vane Desktop IDE (Code—OSS)

Primary product surface per [ADR-001](./architecture/ADR-001-desktop-ide-primary.md).

## Layout

| Path | Role |
|------|------|
| `apps/desktop-ide/` | Git submodule → [XypherOnchain/vane-code-oss](https://github.com/XypherOnchain/vane-code-oss) |
| `scripts/desktop-ide/` | init / brand / dev / build / smoke |
| `apps/desktop/` | **LEGACY** Electron → Next.js Debug shell |

## Prerequisites

- Node.js **≥ 20** (match upstream Code—OSS `.nvmrc` when present)
- Yarn (upstream Classic / Berry per fork `package.json`)
- Python 3 + build tools for native modules
- `git-lfs` installed (`brew install git-lfs && git lfs install`)
- Optional: `GIT_LFS_SKIP_SMUDGE=1` for faster shallow clones

## Quick start

```bash
./scripts/desktop-ide/init.sh
./scripts/desktop-ide/brand.sh
./scripts/desktop-ide/smoke.sh     # no GUI required
./scripts/desktop-ide/dev.sh      # yarn watch / upstream electron
```

First `yarn`/`npm install` inside `apps/desktop-ide` is large and slow.

## Packaging (macOS / Windows / Linux)

Upstream Code—OSS uses gulp electron targets after compile. From `apps/desktop-ide` after dependencies install:

```bash
./scripts/desktop-ide/brand.sh
./scripts/desktop-ide/build.sh
# then upstream packaging, e.g. yarn gulp vscode-darwin-arm64 | vscode-win32-x64 | vscode-linux-x64
```

Exact gulp task names follow the fork’s `package.json` / gulpfile — see upstream wiki “How to Contribute”. Unsigned local builds are fine for internal testing.

## Vane UI

### Agent (Phase 2 — Cursor-like)

1. File → Open Folder  
2. Command Palette → **Vane: Set Agent API Key**  
3. Settings: `vane.agent.provider` (`openai`|`anthropic`), `vane.agent.model`  
4. Activity bar → **Vane** → **Agent**  
5. Chat to list/read/search/edit files and run approved terminal commands (`Cmd/Ctrl+Enter`)

Secrets are redacted. Writes and terminal always confirm. No signing / Live money from chat.

### Placeholders

- Wallets / Transactions views (MetaMask + portfolio later)
- Status bar: provider/model · chain · wallet · mode · vault locked

**Not yet:** vault, signing, swaps, bridges, Live execution.

## Acceptance checklist

- [ ] `./scripts/desktop-ide/init.sh` succeeds
- [ ] `./scripts/desktop-ide/smoke.sh` passes
- [ ] App launches titled **Vane AI**
- [ ] Open a local folder
- [ ] Edit a file; integrated terminal works; Git view works
- [ ] Vane activity bar shows Agent / Wallets / Transactions
- [ ] Status bar shows placeholder Vane state
- [ ] Electron security defaults unchanged (no Node in renderer)

## Upstream merges

See [architecture/code-oss-upstream.md](./architecture/code-oss-upstream.md).
