/**
 * Dev launcher: compile Electron main/preload, then open the shell.
 * Expects `pnpm dev:web` (or pm2) already serving the UI + API.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

async function compile() {
  await new Promise<void>((resolve, reject) => {
    const tsc = spawn("pnpm", ["exec", "tsc", "-p", "tsconfig.electron.json"], {
      cwd: root,
      stdio: "inherit",
      shell: true,
    });
    tsc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`tsc exited ${code}`))));
  });
}

async function main() {
  await compile();
  const electronPath = require("electron") as string;
  const child = spawn(electronPath, ["."], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      VANE_APP_URL: process.env.VANE_APP_URL ?? "http://localhost:3000",
    },
  });
  child.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
