#!/usr/bin/env bash
# Production-ish compile of Vane Code—OSS for local packaging experiments.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IDE="$ROOT/apps/desktop-ide"
cd "$IDE"

"$ROOT/scripts/desktop-ide/brand.sh"

if [[ ! -d node_modules ]]; then
  yarn install || npm install
fi

echo "==> Compiling Vane AI desktop-ide"
if yarn run -s 2>/dev/null | grep -q '^compile$'; then
  yarn compile
elif npm run 2>/dev/null | grep -q 'compile'; then
  npm run compile
else
  echo "No compile script found — see package.json scripts and docs/DESKTOP_IDE.md" >&2
  exit 1
fi

echo "OK: compile finished. Package with upstream gulp electron targets (mac/win/linux)."
