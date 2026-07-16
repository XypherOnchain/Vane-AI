/**
 * Dev launcher: compile Electron main/preload, then open the shell.
 * Expects `pnpm dev:web` (or pm2) already serving the UI + API.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function findElectronBinary(): string {
  // Prefer the pnpm/.bin shim — more reliable than createRequire('electron') under ESM.
  const candidates = [
    path.join(root, "node_modules", ".bin", "electron"),
    path.join(root, "..", "..", "node_modules", ".bin", "electron"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  // Fallback: electron package path layout
  try {
    const pkg = path.dirname(
      fileURLToPath(import.meta.resolve("electron/package.json")),
    );
    const platformPath = path.join(pkg, "cli.js");
    if (fs.existsSync(platformPath)) return process.execPath; // run via node cli.js
  } catch {
    /* fall through */
  }
  throw new Error(
    "Electron binary not found. Run `pnpm install` from the monorepo root.",
  );
}

async function compile() {
  await new Promise<void>((resolve, reject) => {
    const tsc = spawn("pnpm", ["exec", "tsc", "-p", "tsconfig.electron.json"], {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    tsc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`tsc exited ${code}`))));
  });
}

async function main() {
  await compile();

  const bin = findElectronBinary();
  const isJsCli = bin.endsWith("cli.js") || bin === process.execPath;
  const args = isJsCli
    ? [path.join(path.dirname(fileURLToPath(import.meta.resolve("electron/package.json"))), "cli.js"), "."]
    : ["."];
  const cmd = isJsCli ? process.execPath : bin;

  console.log(`[vane-desktop] launching ${cmd} ${args.join(" ")}`);
  const child = spawn(cmd, isJsCli ? args : args, {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: undefined,
      VANE_APP_URL: process.env.VANE_APP_URL ?? "http://localhost:3000",
    },
  });
  child.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
