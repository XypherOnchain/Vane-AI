# Vane Desktop

## Dev

```bash
pnpm desktop
```

Unset `ELECTRON_RUN_AS_NODE` if launching from Cursor (it breaks Electron).

## Local sidecar

On launch, desktop starts `http://127.0.0.1:4010`:

- `GET /health` — mode banner + live disabled
- `GET /local/list-dir?path=` — read local folders for Workspace
- `/v1/*` — proxy to `API_URL` when reachable

## Dist (internal)

```bash
pnpm desktop:dist
```

Produces unsigned `.dmg` / zip under `apps/desktop/release`. Code signing is documented for later; not required for internal Phase 1 testing.

## Deep links

`vane://debug/tx/<hash>` → `{APP_URL}/debug/tx/<hash>`
