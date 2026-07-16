# LEGACY — Electron → Next.js Debug shell

> **Status: LEGACY / transitional**  
> Primary product is the Code—OSS IDE at `apps/desktop-ide`.  
> See [ADR-001](../../docs/architecture/ADR-001-desktop-ide-primary.md) and [DESKTOP_IDE.md](../../docs/DESKTOP_IDE.md).

This package is a thin Electron window that loads the Next.js Debug UI (`APP_URL`, default `http://localhost:3000/debug`). It is **not** the Vane IDE (no editor, terminal, or Git workbench).

Retain until `apps/desktop-ide` can:

1. Boot as Vane AI  
2. Open a folder  
3. Use integrated terminal + Git  
4. Show Agent / Wallets / Transactions views  

Then remove or archive this shell.

## Dev (legacy)

```bash
pnpm dev:web    # from monorepo root
pnpm desktop    # Electron → web Debug
```

## Deep links (legacy)

| URL | Opens |
|-----|--------|
| `vane://debug` | Web workspace |
| `vane://debug/tx/<hash>` | Web tx inspector |

## Security note

Preload stays sandboxed (`contextIsolation`, no Node in renderer). Do not add vault or signing here — that belongs in `vane-walletd` (later phase).
