#!/usr/bin/env bash
# Initialize the Code—OSS submodule and verify toolchain.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "==> Vane desktop-ide init"
if [[ ! -f .gitmodules ]] || ! grep -q 'apps/desktop-ide' .gitmodules; then
  echo "ERROR: apps/desktop-ide submodule not configured (.gitmodules missing entry)" >&2
  exit 1
fi

export GIT_LFS_SKIP_SMUDGE="${GIT_LFS_SKIP_SMUDGE:-1}"
git submodule update --init --depth 1 apps/desktop-ide

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  echo "WARN: Code—OSS typically needs Node >= 20 (found major=$NODE_MAJOR)" >&2
fi

if ! command -v python3 >/dev/null; then
  echo "WARN: python3 recommended for native module builds" >&2
fi

echo "OK: submodule at apps/desktop-ide"
echo "Next: ./scripts/desktop-ide/brand.sh && ./scripts/desktop-ide/dev.sh"
echo "Docs: docs/DESKTOP_IDE.md"
