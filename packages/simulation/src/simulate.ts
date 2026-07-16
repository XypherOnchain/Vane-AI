import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type SimProvider = "tenderly" | "anvil" | "unavailable";

export interface SimRequest {
  chainId: number;
  txHash: string;
  from?: string;
  to?: string;
  data?: string;
  value?: string;
  blockNumber?: string;
  /** Optional patch description for before/after labeling */
  patchNote?: string;
}

export interface SimResult {
  provider: SimProvider;
  mode: "simulation";
  before: { status: "success" | "reverted" | "unknown"; note: string };
  after: { status: "success" | "reverted" | "unknown" | "not_run"; note: string };
  assetDelta?: string;
  raw?: Record<string, unknown>;
  error?: string;
}

function tenderlyConfigured(): boolean {
  return Boolean(
    process.env.TENDERLY_ACCESS_KEY &&
      process.env.TENDERLY_ACCOUNT_SLUG &&
      process.env.TENDERLY_PROJECT_SLUG,
  );
}

async function simulateTenderly(req: SimRequest): Promise<SimResult> {
  const account = process.env.TENDERLY_ACCOUNT_SLUG!;
  const project = process.env.TENDERLY_PROJECT_SLUG!;
  const key = process.env.TENDERLY_ACCESS_KEY!;
  const url = `https://api.tenderly.co/api/v1/account/${account}/project/${project}/simulate`;
  const body = {
    network_id: String(req.chainId),
    from: req.from,
    to: req.to,
    input: req.data,
    value: req.value ?? "0",
    save: false,
    save_if_fails: true,
    simulation_type: "full",
    block_number: req.blockNumber ? Number(req.blockNumber) : undefined,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Access-Key": key,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    return {
      provider: "tenderly",
      mode: "simulation",
      before: { status: "unknown", note: "Tenderly request failed" },
      after: { status: "not_run", note: "Skipped" },
      error: `Tenderly ${res.status}: ${text.slice(0, 300)}`,
    };
  }
  const json = (await res.json()) as {
    transaction?: { status?: boolean; error_message?: string };
    simulation?: { status?: boolean };
  };
  const ok = json.transaction?.status ?? json.simulation?.status;
  return {
    provider: "tenderly",
    mode: "simulation",
    before: {
      status: ok ? "success" : "reverted",
      note: json.transaction?.error_message ?? (ok ? "Simulation succeeded" : "Simulation reverted"),
    },
    after: {
      status: "not_run",
      note: req.patchNote
        ? "Patch applied only in proposal — re-sim after code change on fork"
        : "No on-chain patch applied (Phase 1 hard gate)",
    },
    assetDelta: "See Tenderly UI for token diffs when available",
    raw: json as Record<string, unknown>,
  };
}

function runCmd(
  bin: string,
  args: string[],
  opts?: { cwd?: string; timeoutMs?: number },
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      cwd: opts?.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, opts?.timeoutMs ?? 45_000);
    child.stdout.on("data", (d) => {
      stdout += String(d);
    });
    child.stderr.on("data", (d) => {
      stderr += String(d);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ code: 1, stdout, stderr: e.message });
    });
  });
}

async function simulateAnvil(req: SimRequest): Promise<SimResult> {
  const forkRpc = process.env.FORK_RPC_URL || process.env.ROBINHOOD_MAINNET_RPC_URL;
  if (!forkRpc) {
    return {
      provider: "unavailable",
      mode: "simulation",
      before: { status: "unknown", note: "No FORK_RPC_URL / ROBINHOOD_MAINNET_RPC_URL" },
      after: { status: "not_run", note: "Skipped" },
      error: "Configure FORK_RPC_URL or Tenderly to run fork simulation",
    };
  }
  const anvil = process.env.ANVIL_BIN || "anvil";
  const dir = await mkdtemp(join(tmpdir(), "vane-sim-"));
  try {
    // Start anvil briefly, eth_call the tx, shut down — never broadcast
    const port = 18545 + Math.floor(Math.random() * 1000);
    const args = ["--fork-url", forkRpc, "--port", String(port), "--silent"];
    if (req.blockNumber) args.push("--fork-block-number", req.blockNumber);
    const child = spawn(anvil, args, { stdio: ["ignore", "pipe", "pipe"] });
    await new Promise((r) => setTimeout(r, 1500));
    const callBody = {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [
        {
          from: req.from,
          to: req.to,
          data: req.data,
          value: req.value ? `0x${BigInt(req.value).toString(16)}` : "0x0",
        },
        "latest",
      ],
    };
    let beforeStatus: SimResult["before"]["status"] = "unknown";
    let note = "anvil eth_call";
    try {
      const res = await fetch(`http://127.0.0.1:${port}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(callBody),
      });
      const json = (await res.json()) as { result?: string; error?: { message?: string } };
      if (json.error) {
        beforeStatus = "reverted";
        note = json.error.message ?? "reverted";
      } else {
        beforeStatus = "success";
        note = `eth_call ok (${String(json.result).slice(0, 18)}…)`;
      }
    } catch (e) {
      note = e instanceof Error ? e.message : String(e);
      beforeStatus = "unknown";
    }
    child.kill("SIGTERM");
    await writeFile(
      join(dir, "result.json"),
      JSON.stringify({ beforeStatus, note, txHash: req.txHash }, null, 2),
    );
    return {
      provider: "anvil",
      mode: "simulation",
      before: { status: beforeStatus, note },
      after: {
        status: "not_run",
        note: "Live broadcast disabled in Phase 1. Apply patch locally and re-sim.",
      },
      assetDelta: "Re-run with balance snapshots after patch for numeric delta",
    };
  } catch (e) {
    const probe = await runCmd(anvil, ["--version"], { timeoutMs: 5_000 });
    return {
      provider: probe.code === 0 ? "anvil" : "unavailable",
      mode: "simulation",
      before: { status: "unknown", note: "Anvil fork failed" },
      after: { status: "not_run", note: "Skipped" },
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Fork-simulate a transaction. Prefer Tenderly; else Anvil.
 * Never invents success — reports unavailable when neither works.
 */
export async function simulateRepair(req: SimRequest): Promise<SimResult> {
  if (tenderlyConfigured()) {
    return simulateTenderly(req);
  }
  return simulateAnvil(req);
}
