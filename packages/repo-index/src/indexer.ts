import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { keccak256, toBytes } from "./keccak.js";

export interface IndexedFile {
  path: string;
  kind: "solidity" | "typescript" | "abi" | "artifact" | "other";
  size: number;
  hash: string;
  selectors?: Record<string, { name: string; line: number }>;
}

export interface RepoIndex {
  root: string;
  indexedAt: string;
  files: IndexedFile[];
  abis: { path: string; contractName?: string }[];
}

export interface SelectorHit {
  selector: string;
  functionName: string;
  path: string;
  line: number;
  note?: string;
}

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "out",
  "cache",
  "coverage",
  ".next",
  "lib",
  "broadcast",
]);

function walk(dir: string, out: string[], depth = 0): void {
  if (depth > 12) return;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out, depth + 1);
    else if (st.isFile()) out.push(full);
  }
}

function kindOf(path: string): IndexedFile["kind"] {
  if (path.endsWith(".sol")) return "solidity";
  if (path.endsWith(".abi.json") || (path.endsWith(".json") && path.includes("/abi"))) return "abi";
  if (path.includes("/out/") || path.includes("/artifacts/")) return "artifact";
  if (path.endsWith(".ts") || path.endsWith(".tsx") || path.endsWith(".js")) return "typescript";
  return "other";
}

function selectorFor(name: string, argTypes: string[]): string {
  const sig = `${name}(${argTypes.join(",")})`;
  return keccak256(toBytes(sig)).slice(0, 10);
}

function splitArgs(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    if (ch === ")" || ch === "]" || ch === "}") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

function parseSoliditySelectors(source: string): Record<string, { name: string; line: number }> {
  const out: Record<string, { name: string; line: number }> = {};
  const lines = source.split(/\r?\n/);
  const fnRe = /^\s*function\s+([A-Za-z_][\w]*)\s*\(([^)]*)\)/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(fnRe);
    if (!m) continue;
    const name = m[1]!;
    const rawArgs = m[2]!.trim();
    const argTypes: string[] = [];
    if (rawArgs) {
      for (const part of splitArgs(rawArgs)) {
        const tokens = part.trim().split(/\s+/);
        if (!tokens[0] || tokens[0] === "mapping") continue;
        argTypes.push(tokens[0]!);
      }
    }
    try {
      out[selectorFor(name, argTypes).toLowerCase()] = { name, line: i + 1 };
    } catch {
      /* skip */
    }
  }
  return out;
}

function loadArtifactSelectors(path: string): Record<string, { name: string; line: number }> {
  try {
    const json = JSON.parse(readFileSync(path, "utf8")) as {
      methodIdentifiers?: Record<string, string>;
      abi?: { type: string; name?: string; inputs?: { type: string }[] }[];
    };
    const out: Record<string, { name: string; line: number }> = {};
    if (json.methodIdentifiers) {
      for (const [sig, sel] of Object.entries(json.methodIdentifiers)) {
        const name = sig.split("(")[0]!;
        const hex = (sel.startsWith("0x") ? sel : `0x${sel}`).toLowerCase();
        out[hex] = { name, line: 0 };
      }
    }
    if (json.abi) {
      for (const item of json.abi) {
        if (item.type !== "function" || !item.name) continue;
        const types = (item.inputs ?? []).map((i) => i.type);
        out[selectorFor(item.name, types).toLowerCase()] = { name: item.name, line: 0 };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function indexLocalRepo(root: string): RepoIndex {
  if (!root || !existsSync(root)) {
    return { root, indexedAt: new Date().toISOString(), files: [], abis: [] };
  }
  const all: string[] = [];
  walk(root, all);
  const files: IndexedFile[] = [];
  const abis: RepoIndex["abis"] = [];

  for (const full of all) {
    const rel = relative(root, full).replaceAll("\\", "/");
    let kind = kindOf(rel);
    if (kind === "other" && !rel.endsWith(".json")) continue;
    if (
      kind === "other" &&
      !rel.includes("artifacts") &&
      !rel.includes("/out/") &&
      !rel.endsWith(".json")
    ) {
      continue;
    }
    let content = "";
    try {
      const st = statSync(full);
      if (st.size > 2_000_000) continue;
      content = readFileSync(full, "utf8");
    } catch {
      continue;
    }
    const hash = createHash("sha256").update(content).digest("hex").slice(0, 16);
    let selectors: Record<string, { name: string; line: number }> | undefined;
    if (kind === "solidity") {
      selectors = parseSoliditySelectors(content);
    } else if (
      rel.endsWith(".json") &&
      (rel.includes("artifacts") || rel.includes("/out/") || rel.includes("abi"))
    ) {
      selectors = loadArtifactSelectors(full);
      abis.push({ path: rel, contractName: rel.split("/").pop()?.replace(/\.json$/, "") });
      kind = "artifact";
    }
    files.push({ path: rel, kind, size: content.length, hash, selectors });
  }

  return { root, indexedAt: new Date().toISOString(), files, abis };
}

export function searchRepoIndex(index: RepoIndex, query: string, limit = 20): IndexedFile[] {
  const q = query.toLowerCase();
  return index.files
    .filter(
      (f) =>
        f.path.toLowerCase().includes(q) ||
        Object.values(f.selectors ?? {}).some((s) => s.name.toLowerCase().includes(q)),
    )
    .slice(0, limit);
}

export function mapSelectorToSource(index: RepoIndex, selector: string): SelectorHit | null {
  const sel = selector.toLowerCase().startsWith("0x")
    ? selector.toLowerCase().slice(0, 10)
    : `0x${selector.toLowerCase().slice(0, 8)}`;
  for (const f of index.files) {
    const hit = f.selectors?.[sel];
    if (hit) {
      return {
        selector: sel,
        functionName: hit.name,
        path: f.path,
        line: hit.line || 1,
        note: hit.line ? undefined : "Mapped from ABI/artifact (line unknown)",
      };
    }
  }
  return null;
}
