#!/usr/bin/env bash
# Smoke checks that do not require a full Electron GUI session.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IDE="$ROOT/apps/desktop-ide"

fail() { echo "FAIL: $*" >&2; exit 1; }

[[ -f "$IDE/product.json" ]] || fail "product.json missing — run init.sh"
[[ -d "$IDE/extensions/vane-workbench" ]] || fail "vane-workbench extension missing"
[[ -f "$IDE/extensions/vane-workbench/package.json" ]] || fail "vane-workbench package.json missing"

"$ROOT/scripts/desktop-ide/brand.sh"

IDE="$IDE" node <<'NODE'
const fs = require("fs");
const path = require("path");
const ide = process.env.IDE;
const product = JSON.parse(fs.readFileSync(path.join(ide, "product.json"), "utf8"));
const ext = JSON.parse(fs.readFileSync(path.join(ide, "extensions/vane-workbench/package.json"), "utf8"));
if (product.nameLong !== "Vane AI") throw new Error("nameLong not Vane AI");
if (product.applicationName !== "vane") throw new Error("applicationName not vane");
if (product.urlProtocol !== "vane") throw new Error("urlProtocol not vane");
if (product.darwinBundleIdentifier !== "ai.vane.code") throw new Error("darwinBundleIdentifier wrong");
const viewsContainers = ext.contributes?.viewsContainers?.activitybar || [];
if (!viewsContainers.some((v) => v.id === "vane")) throw new Error("activity bar container missing");
const cmds = (ext.contributes?.commands || []).map((c) => c.command);
for (const c of ["vane.openAgent", "vane.openWallets", "vane.openTransactions"]) {
  if (!cmds.includes(c)) throw new Error("missing command " + c);
}
if (!ext.main) throw new Error("extension main entry missing");
if (!fs.existsSync(path.join(ide, "extensions/vane-workbench", ext.main))) {
  throw new Error("extension main file missing: " + ext.main);
}
console.log("OK: smoke branding + vane-workbench contributes");
NODE

echo "Manual GUI checklist: docs/DESKTOP_IDE.md#acceptance-checklist"
