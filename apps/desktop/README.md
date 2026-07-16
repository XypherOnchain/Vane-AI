# Vane Desktop

Downloadable Electron app — the **Cursor-like** surface for Vane.

## Why desktop?

A website is fine for demos. A desktop app is where developers actually live:

- Local repo paths on disk
- Deep links from Telegram (`vane://debug/tx/0x…`) open the exact inspector
- Native menu, multi-window later, local encrypted vault (Phase 4)
- Feels like Cursor / VS Code, not another SaaS tab

## Dev

1. Start the web UI + API (from monorepo root):

```bash
pnpm dev:web
# or: npx pm2 start …
```

2. Open the desktop shell:

```bash
pnpm desktop
# → apps/desktop Electron window loads http://localhost:3000/debug
```

## Ship installers

```bash
pnpm desktop:dist
# → apps/desktop/release/  (.dmg / .exe / AppImage)
```

Requires code-signing credentials for macOS notarization in production; unsigned builds work for local testing.

## Deep links

| URL | Opens |
|-----|--------|
| `vane://debug` | Workspace |
| `vane://debug/tx/<hash>` | Tx inspector deep link |

Telegram failure alerts include both a web URL and a `vane://` link.
