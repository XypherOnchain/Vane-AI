# Code—OSS upstream merge notes

**Fork:** https://github.com/XypherOnchain/vane-code-oss  
**Submodule:** `apps/desktop-ide`  
**Upstream:** https://github.com/microsoft/vscode

## Vane-owned touch points

| Path | Change |
|------|--------|
| `product.json` | Branding overlay applied by `scripts/desktop-ide/brand.sh` from `vane-product.overlay.json` |
| `extensions/vane-workbench/**` | Built-in Vane activity bar, views, status bar, commands, settings |

## Merge strategy

1. Fetch upstream tags/commits into the fork.
2. Merge or rebase carefully; resolve conflicts in `product.json` by re-running `brand.sh`.
3. Never drop `extensions/vane-workbench`.
4. Do not weaken Electron `sandbox` / `contextIsolation` / `nodeIntegration` defaults when resolving conflicts in Electron main process files.
5. Bump the submodule SHA in the Vane-AI monorepo after fork updates.

## Branding overlay source of truth

Monorepo file: [`scripts/desktop-ide/vane-product.overlay.json`](../../scripts/desktop-ide/vane-product.overlay.json)

Key identity fields:

- `nameShort` / `nameLong`: `Vane AI`
- `applicationName`: `vane`
- `dataFolderName`: `.vane-ai`
- `urlProtocol`: `vane`
- `darwinBundleIdentifier`: `ai.vane.code`
- `win32AppUserModelId`: `ai.vane.code`

## Packages boundary

Do not import `@vane/*` monorepo packages into the renderer or this extension in Phase 1. Later phases use Node-side hosts (agent-host, walletd) with typed IPC.
