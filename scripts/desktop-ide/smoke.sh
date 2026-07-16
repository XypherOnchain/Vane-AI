#!/usr/bin/env bash
# Smoke checks that do not require a full Electron GUI session.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IDE="$ROOT/apps/desktop-ide"

fail() { echo "FAIL: $*" >&2; exit 1; }

[[ -f "$IDE/product.json" ]] || fail "product.json missing — run init.sh"
[[ -d "$IDE/extensions/vane-workbench" ]] || fail "vane-workbench extension missing"
[[ -f "$IDE/extensions/vane-workbench/package.json" ]] || fail "vane-workbench package.json missing"
[[ -f "$IDE/extensions/vane-workbench/src/agentView.ts" ]] || fail "agentView.ts missing (Phase 2 Agent)"
[[ -f "$IDE/extensions/vane-workbench/src/agentLoop.ts" ]] || fail "agentLoop.ts missing"
[[ -f "$IDE/extensions/vane-workbench/src/tools.ts" ]] || fail "tools.ts missing"
[[ -f "$IDE/extensions/vane-workbench/src/modelGateway.ts" ]] || fail "modelGateway.ts missing"
[[ -f "$IDE/extensions/vane-workbench/tsconfig.json" ]] || fail "vane-workbench tsconfig missing"

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
const agentView = (ext.contributes?.views?.vane || []).find((v) => v.id === "vane.agent");
if (!agentView || agentView.type !== "webview") throw new Error("vane.agent must be a webview");
const cmds = (ext.contributes?.commands || []).map((c) => c.command);
for (const c of ["vane.openAgent", "vane.agent.setApiKey", "vane.openWallets", "vane.openTransactions"]) {
  if (!cmds.includes(c)) throw new Error("missing command " + c);
}
if (!ext.main) throw new Error("extension main entry missing");
const mainBase = path.join(ide, "extensions/vane-workbench", ext.main);
const mainOk =
  fs.existsSync(mainBase) ||
  fs.existsSync(mainBase + ".js") ||
  fs.existsSync(path.join(ide, "extensions/vane-workbench/src/extension.ts"));
if (!mainOk) throw new Error("extension main missing (compile out/ or src/extension.ts): " + ext.main);
if (!String(ext.main).includes("out/")) throw new Error("extension main should point at compiled out/");
console.log("OK: smoke branding + vane-workbench contributes");
NODE

echo "Manual GUI checklist: docs/DESKTOP_IDE.md#acceptance-checklist"
