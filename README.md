# Vane AI

**Cursor for crypto** — a downloadable Code—OSS–based AI IDE for building, testing, debugging, and safely operating on-chain software.

Repo: [XypherOnchain/Vane-AI](https://github.com/XypherOnchain/Vane-AI)  
Product: [`docs/PRODUCT.md`](./docs/PRODUCT.md) · **ADR-001:** [`docs/architecture/ADR-001-desktop-ide-primary.md`](./docs/architecture/ADR-001-desktop-ide-primary.md)

## Primary product: Desktop IDE

The primary surface is a branded Code—OSS fork (Git submodule):

```bash
# Init submodule + check toolchain
./scripts/desktop-ide/init.sh

# Apply/verify Vane product branding
./scripts/desktop-ide/brand.sh

# Dev build / launch (see docs/DESKTOP_IDE.md)
./scripts/desktop-ide/dev.sh
```

Details: [`docs/DESKTOP_IDE.md`](./docs/DESKTOP_IDE.md)

## Secondary: Web Debug dogfood

The Next.js Debug UI remains for demos until flows move into the IDE:

```bash
cp .env.example .env
pnpm install
pnpm dev:web            # API :4000 + Next.js :3000 → /debug
```

## Legacy: Electron → Next wrapper

[`apps/desktop`](./apps/desktop) is **LEGACY**. It only loads the web Debug UI. Prefer `apps/desktop-ide` once it boots.

```bash
pnpm desktop            # legacy shell
```

## Monorepo packages (shared)

Reusable crypto/agent packages live here and will be consumed by IDE hosts later — never from the renderer with secrets:

- `@vane/policy`, `@vane/simulation`, `@vane/project-graph`, `@vane/repo-index`, `@vane/chain`

See [`docs/architecture/reusable-module-inventory.md`](./docs/architecture/reusable-module-inventory.md).

## Security

Private keys must never reach the browser UI, model providers, Telegram, or logs.  
[`docs/architecture/security-boundaries.md`](./docs/architecture/security-boundaries.md)
