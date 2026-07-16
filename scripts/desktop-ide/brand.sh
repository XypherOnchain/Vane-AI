#!/usr/bin/env bash
# Apply or verify Vane product.json branding in apps/desktop-ide.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PRODUCT="$ROOT/apps/desktop-ide/product.json"
PATCH="$ROOT/scripts/desktop-ide/vane-product.overlay.json"

if [[ ! -f "$PRODUCT" ]]; then
  echo "ERROR: $PRODUCT missing — run ./scripts/desktop-ide/init.sh" >&2
  exit 1
fi
if [[ ! -f "$PATCH" ]]; then
  echo "ERROR: overlay missing: $PATCH" >&2
  exit 1
fi

ROOT="$ROOT" node <<'NODE'
const fs = require("fs");
const path = require("path");
const root = process.env.ROOT;
const productPath = path.join(root, "apps/desktop-ide/product.json");
const overlayPath = path.join(root, "scripts/desktop-ide/vane-product.overlay.json");
const product = JSON.parse(fs.readFileSync(productPath, "utf8"));
const overlay = JSON.parse(fs.readFileSync(overlayPath, "utf8"));
const next = { ...product, ...overlay };
fs.writeFileSync(productPath, JSON.stringify(next, null, "\t") + "\n");
for (const k of ["nameShort", "nameLong", "applicationName", "urlProtocol", "darwinBundleIdentifier"]) {
  if (next[k] !== overlay[k]) {
    console.error(`FAIL: ${k} expected ${overlay[k]} got ${next[k]}`);
    process.exit(1);
  }
}
console.log("OK: Vane branding applied to product.json");
console.log(`  nameLong=${next.nameLong} applicationName=${next.applicationName} urlProtocol=${next.urlProtocol}`);
NODE
