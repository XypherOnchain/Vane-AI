# Reusable module inventory

Catalog for the Code—OSS pivot. **Keep** = continue in monorepo. **Adapt** = reshape for IDE hosts. **Retire** = do not grow; replace with IDE surfaces.

## Keep / adapt (crypto + agent building blocks)

| Module | Path | Verdict | Notes |
|--------|------|---------|-------|
| Policy engine | `packages/policy` | **Keep** | Move toward `packages/policy-engine`; host in walletd / agent-host later |
| Simulation | `packages/simulation` | **Keep** | Becomes simulation-engine adapter (Tenderly/Anvil) |
| Project graph | `packages/project-graph` | **Adapt** | Maps to local `.vane/` + SQLite project memory |
| Repo index | `packages/repo-index` | **Adapt** | Feeds IDE context engine / symbol index |
| Chain / viem | `packages/chain` | **Keep** | Basis for `packages/evm-client` |
| Shared types | `packages/shared-types` | **Keep** | Split as schemas grow (Zod) |
| Config | `packages/config` | **Adapt** | Desktop uses local settings + OS keychain |
| Workflow IR | `packages/workflow` | **Adapt** | Long-running jobs → persistent checkpoints |
| Secret redaction | `apps/api/src/services/debug-agent.ts` (`redactSecrets`) | **Adapt** | Extract to `packages/secret-redactor` |
| Tx inspector | `apps/api/src/services/tx-inspector.ts` | **Adapt** | Port into IDE debugger contrib / service |
| Telegram debug | `apps/telegram-debug` | **Adapt** | Companion gateway; never signing |
| VS Code extension | `apps/vscode-extension` | **Retire as primary** | Superseded by Code—OSS; may remain thin bridge |

## Secondary / demo surfaces

| Module | Path | Verdict |
|--------|------|---------|
| Next Debug UI | `apps/web` `/debug/*` | **Secondary** — demos until IDE ports Debug |
| Electron Next shell | `apps/desktop` | **Legacy** — keep until IDE acceptance |
| Web Build/Flow/Operate/Agent pages | `apps/web/src/app/{build,flow,operate,agent}` | **Demo stubs** — not IDE product |
| API Debug routes | `apps/api/src/routes/debug.ts` | **Keep temporarily** for web dogfood |

## Empty / radar-era stubs (do not grow)

`packages/ai`, `alerts`, `contract-scanner`, `graph-engine`, `intelligence`, `observability`, `scoring`, `ui`, `validation` — placeholders. Prefer new packages named in the complete build plan (`agent-core`, `model-gateway`, `wallet-vault`, etc.) when implementing those phases.

## Integration boundary (Phase 1+)

```text
apps/desktop-ide (Code—OSS fork)
  └── workbench / built-in extensions  →  typed IPC
        └── services/* (agent-host, execution-host, walletd)  →  @vane/* packages
```

Rules:

1. Renderer/workbench UI must not import vault or private-key modules.
2. Phase 1 does **not** wire `@vane/*` into the Code—OSS build graph.
3. Later phases publish or path-link packages into Node-side hosts only.
