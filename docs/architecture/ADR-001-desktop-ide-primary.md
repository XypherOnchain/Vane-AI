# ADR-001: Desktop IDE (Code—OSS) is the primary product

**Status:** Accepted  
**Date:** 2026-07-16  
**Branch:** `phase/00-01-code-oss-foundation`

## Context

Vane AI began as a Next.js Debug workspace wrapped in Electron (`apps/desktop` → `localhost:3000/debug`). That surface is useful for transaction inspection demos, but it is not a development environment. The product definition requires a Cursor/VS Code–class desktop IDE with crypto-native workflows.

## Decision

1. **Primary product** is a branded [Code—OSS](https://github.com/microsoft/vscode) desktop IDE, maintained as a Vane fork and consumed from this monorepo via Git submodule at `apps/desktop-ide`.
2. **Web** (`apps/web`) is secondary: demos, light Debug UI, marketing, and account/docs later — not the home for private keys or signing.
3. **Legacy Electron shell** (`apps/desktop`) remains until the Code—OSS IDE boots with folder open, terminal, Git, and Vane views. It must not drive new architecture.
4. **Reusable packages** (`packages/policy`, `simulation`, `project-graph`, `repo-index`, `chain`, etc.) stay in this monorepo. The IDE consumes them later through defined host/IPC boundaries — never by importing vault code into the renderer.

## Consequences

- Product docs and README point to Code—OSS as primary.
- `/agent` on the web is a policy-job demo, not the IDE agent panel.
- No private-key logic may be added to browser/renderer code.
- Upstream merges of Code—OSS require documented touch-points (`code-oss-upstream.md`).

## Related

- [reusable-module-inventory.md](./reusable-module-inventory.md)
- [security-boundaries.md](./security-boundaries.md)
- [DESKTOP_IDE.md](../DESKTOP_IDE.md)
