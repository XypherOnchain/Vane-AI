# Phase 1 acceptance checklist

A developer can complete the Debug loop end-to-end:

1. [x] Create project, connect GitHub URL + local repo path, set RPC + treasury/deployer watch addresses, set Telegram chat id  
       → Workspace `/debug` + `POST /v1/debug/projects*`
2. [x] Paste a failed tx hash  
       → Tx Inspector `/debug/tx`
3. [x] See decoded failure + mapped source function (when repo indexed)  
       → inspector `relatedCode` / `functionName`
4. [x] Get patch + test + fork sim result (Tenderly or Anvil; unavailable reported honestly)  
       → Repair `/debug/repair` + `POST /v1/debug/tx/:hash/repair`
5. [x] Save incident; Telegram alert with `vane://` deep link  
       → `POST /v1/debug/tx/:hash/debug` + `POST /v1/debug/alerts/tx-failure` + `apps/telegram-debug`
6. [x] Ask “why did this fail?” in chat and get cited answer  
       → `/debug/chat` + `POST /v1/debug/chat`

## Gates

- Live broadcast disabled (`liveEnabled: false`)
- No trading / radar product surface
- Secrets redacted in debug agent

## Desktop

- Sidecar on `:4010`, mode banner, `pnpm desktop:dist` for unsigned installers — see [`DESKTOP.md`](./DESKTOP.md)
