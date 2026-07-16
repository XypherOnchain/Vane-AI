# Security boundaries

Vane handles code execution and financial signing. These capabilities must not live in the renderer (or the Next.js browser UI).

## Process model (target)

```text
┌─────────────────────────────────────────────────────────┐
│ Renderer / Workbench                                      │
│ Editor, chat, wallet list, tx review                      │
│ No raw secrets, no direct Node, no vault FS               │
└───────────────────────┬─────────────────────────────────┘
                        │ typed IPC
┌───────────────────────▼─────────────────────────────────┐
│ Main process                                              │
│ Window control, permission mediation                      │
└───────┬──────────────────┬───────────────────┬──────────┘
        │                  │                   │
┌───────▼───────┐  ┌───────▼─────────┐  ┌─────▼─────────┐
│ Agent Host    │  │ Execution Host  │  │ vane-walletd  │
│ Models/tools  │  │ Terminal/git    │  │ Vault/sign    │
└───────────────┘  └─────────────────┘  └───────────────┘
```

## Forbidden

Raw private keys / seeds must never be sent to:

- Vane servers, model providers, analytics, crash reporters, Telegram, remote MCP
- Renderer process, browser `apps/web`, or agent prompts

The model may see wallet **identifiers and addresses** only.

## Operating modes

| Mode | Who enables | Notes |
|------|-------------|-------|
| Code Only | User | No chain writes |
| Simulation | User | Forks / sims only |
| Testnet | User | Testnet broadcast after approval |
| Live | **User only via UI** | AI must never enable Live |

## Current monorepo status (Phase 0)

- Web/API: watch-only wallets, policy gates, redaction — **no vault, no signing**
- Legacy Electron shell: loads web Debug — **no Node in renderer** (`contextIsolation`, sandboxed preload)
- Code—OSS fork: must preserve upstream Electron security defaults (no weakening `nodeIntegration` / sandbox)

## Agent vs wallet

- Agent may propose transactions / request unlock UI
- Agent must not unlock vault, decrypt keys, mutate policy, approve its own txs, or delete audit records
- There is no model-accessible `wallet.exportPlaintextPrivateKey`
