#!/usr/bin/env node
/**
 * Compile Electron main/preload, then launch the real Electron binary
 * (avoids `pnpm exec electron` breaking under "type": "module").
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const monorepo = path.resolve(root, "../..");

const tsc = spawnSync("pnpm", ["exec", "tsc", "-p", "tsconfig.electron.json"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

function findBinary() {
  const candidates = [
    path.join(
      monorepo,
      "node_modules/.pnpm/electron@35.7.5/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
    ),
  ];
  // Any electron@* install
  const pnpmDir = path.join(monorepo, "node_modules/.pnpm");
  if (fs.existsSync(pnpmDir)) {
    for (const name of fs.readdirSync(pnpmDir)) {
      if (!name.startsWith("electron@")) continue;
      const bin = path.join(
        pnpmDir,
        name,
        "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
      );
      if (fs.existsSync(bin)) candidates.unshift(bin);
      const win = path.join(pnpmDir, name, "node_modules/electron/dist/electron.exe");
      if (fs.existsSync(win)) candidates.unshift(win);
      const linux = path.join(pnpmDir, name, "node_modules/electron/dist/electron");
      if (fs.existsSync(linux)) candidates.unshift(linux);
    }
  }
  const hit = candidates.find((c) => fs.existsSync(c));
  if (!hit) throw new Error("Electron binary not found — run pnpm install");
  return hit;
}

const electronBin = findBinary();
console.log(`[vane-desktop] ${electronBin}`);
const env = {
  ...process.env,
  VANE_APP_URL: process.env.VANE_APP_URL ?? "http://localhost:3000",
};
// Cursor/IDE shells often set this, which makes Electron run as plain Node
// and breaks `require('electron').app`.
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electronBin, ["."], {
  cwd: root,
  stdio: "inherit",
  env,
});
child.on("exit", (code) => process.exit(code ?? 0));
