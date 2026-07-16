#!/usr/bin/env bash
# Develop / launch Vane Code—OSS (upstream yarn scripts).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IDE="$ROOT/apps/desktop-ide"
cd "$IDE"

"$ROOT/scripts/desktop-ide/brand.sh"

if [[ ! -d node_modules ]]; then
  echo "==> Installing IDE dependencies (first run is large)…"
  if [[ -f yarn.lock ]]; then
    yarn install
  else
    npm install
  fi
fi

echo "==> Starting Vane AI (Code—OSS watch / electron)"
# Upstream scripts vary by version; try common entrypoints.
if yarn run -s 2>/dev/null | grep -q '^watch$'; then
  exec yarn watch
elif npm run 2>/dev/null | grep -q 'watch'; then
  exec npm run watch
else
  echo "Run the upstream compile then electron, e.g.:"
  echo "  cd apps/desktop-ide && yarn && yarn watch"
  echo "See docs/DESKTOP_IDE.md for pinned Node/Yarn versions."
  exit 1
fi
