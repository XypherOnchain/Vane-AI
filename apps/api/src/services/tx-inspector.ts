import { createRobinhoodProvider, type RpcProvider } from "@vane/chain";
import { loadEnv } from "@vane/config";
import {
  decodeErrorResult,
  formatEther,
  hexToString,
  isHex,
  type Hex,
  type TransactionReceipt,
} from "viem";

/**
 * Phase 1 transaction debugger.
 * Decodes receipts, logs, and revert data from RPC — no invented findings.
 * Source-code mapping and Tenderly-style full traces land in later iterations.
 */

export interface AssetMovement {
  from: string;
  to: string;
  valueEth: string;
  token?: string;
}

export interface DecodedLog {
  address: string;
  topics: string[];
  data: string;
  /** Best-effort topic0 label when known */
  eventHint?: string;
}

export interface TxInspection {
  dataSource: "rpc";
  mode: "simulation" | "live_read";
  chainId: number;
  hash: string;
  status: "success" | "reverted" | "pending" | "not_found";
  blockNumber: string | null;
  from: string | null;
  to: string | null;
  valueEth: string | null;
  gasUsed: string | null;
  effectiveGasPrice: string | null;
  revertReason: string | null;
  summary: string;
  assetMovements: AssetMovement[];
  logs: DecodedLog[];
  risks: { severity: "critical" | "high" | "medium" | "info"; text: string }[];
  nextSteps: string[];
}

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const APPROVAL_TOPIC =
  "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";

let provider: RpcProvider | null = null;

function getProvider(): RpcProvider {
  if (!provider) provider = createRobinhoodProvider(loadEnv());
  return provider;
}

function decodeRevertData(data: Hex | undefined): string | null {
  if (!data || data === "0x") return null;
  // Error(string)
  if (data.startsWith("0x08c379a0")) {
    try {
      const decoded = decodeErrorResult({
        abi: [{ type: "error", name: "Error", inputs: [{ type: "string", name: "message" }] }],
        data,
      });
      return String(decoded.args[0]);
    } catch {
      /* fall through */
    }
  }
  // Panic(uint256)
  if (data.startsWith("0x4e487b71")) {
    return "Panic (solidity assert / overflow / invalid opcode)";
  }
  try {
    const raw = hexToString(data);
    if (raw.trim()) return raw;
  } catch {
    /* ignore */
  }
  return data.slice(0, 66) + (data.length > 66 ? "…" : "");
}

function logHints(topics: readonly string[]): string | undefined {
  const t0 = topics[0]?.toLowerCase();
  if (t0 === TRANSFER_TOPIC) return "Transfer";
  if (t0 === APPROVAL_TOPIC) return "Approval";
  return undefined;
}

function risksFromReceipt(receipt: TransactionReceipt, valueEth: string): TxInspection["risks"] {
  const risks: TxInspection["risks"] = [];
  if (receipt.status === "reverted") {
    risks.push({ severity: "critical", text: "Transaction reverted — no state changes committed" });
  }
  for (const log of receipt.logs) {
    if (log.topics[0]?.toLowerCase() === APPROVAL_TOPIC) {
      const spender = log.topics[2] ? `0x${log.topics[2].slice(26)}` : "unknown";
      const unlimited =
        log.data ===
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
      if (unlimited) {
        risks.push({
          severity: "high",
          text: `Unlimited approval granted to ${spender}`,
        });
      }
    }
  }
  if (Number(valueEth) > 1) {
    risks.push({
      severity: "medium",
      text: `Native value moved: ${valueEth} ETH — confirm destination role in project memory`,
    });
  }
  return risks;
}

export async function inspectTransaction(hash: string): Promise<TxInspection> {
  const p = getProvider();
  const chainId = p.config.chainId;
  const normalized = hash.toLowerCase() as Hex;
  if (!isHex(normalized) || normalized.length !== 66) {
    return emptyInspection(chainId, hash, "not_found", "Invalid transaction hash.");
  }

  const [tx, receipt] = await Promise.all([
    p.withClient((c) => c.getTransaction({ hash: normalized }).catch(() => null)),
    p.withClient((c) => c.getTransactionReceipt({ hash: normalized }).catch(() => null)),
  ]);

  if (!tx && !receipt) {
    return emptyInspection(chainId, normalized, "not_found", "Transaction not found on this chain.");
  }

  if (tx && !receipt) {
    return {
      ...emptyInspection(chainId, normalized, "pending", "Transaction is pending — no receipt yet."),
      from: tx.from.toLowerCase(),
      to: tx.to?.toLowerCase() ?? null,
      valueEth: formatEther(tx.value),
    };
  }

  const r = receipt!;
  const valueEth = tx ? formatEther(tx.value) : "0";
  let revertReason: string | null = null;

  if (r.status === "reverted" && tx) {
    try {
      await p.withClient((c) =>
        c.call({
          account: tx.from,
          to: tx.to ?? undefined,
          data: tx.input,
          value: tx.value,
          blockNumber: r.blockNumber,
        }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const match = msg.match(/reverted with reason string '([^']+)'/i)
        ?? msg.match(/execution reverted: (.+)/i)
        ?? msg.match(/reverted with the following reason:\n(.+)/i);
      revertReason = match?.[1]?.trim() ?? msg.slice(0, 200);
      if (isHex(msg as Hex)) revertReason = decodeRevertData(msg as Hex) ?? revertReason;
    }
  }

  const logs: DecodedLog[] = r.logs.map((l) => ({
    address: l.address.toLowerCase(),
    topics: l.topics.map(String),
    data: l.data,
    eventHint: logHints(l.topics),
  }));

  const assetMovements: AssetMovement[] = [];
  if (tx && tx.value > 0n && tx.to) {
    assetMovements.push({
      from: tx.from.toLowerCase(),
      to: tx.to.toLowerCase(),
      valueEth,
    });
  }
  for (const log of r.logs) {
    if (log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC || log.topics.length < 3) continue;
    const from = `0x${log.topics[1]!.slice(26)}`;
    const to = `0x${log.topics[2]!.slice(26)}`;
    assetMovements.push({
      from,
      to,
      valueEth: "0",
      token: log.address.toLowerCase(),
    });
  }

  const status = r.status === "success" ? "success" : "reverted";
  const summary =
    status === "success"
      ? `Transaction succeeded in block ${r.blockNumber}. ${logs.length} log(s), ${assetMovements.length} asset movement(s) detected.`
      : `Transaction reverted in block ${r.blockNumber}.${revertReason ? ` Reason: ${revertReason}` : ""}`;

  const nextSteps =
    status === "reverted"
      ? [
          "Save this as an incident in Project Memory",
          "Map the call target to a contract in your workspace",
          "Generate a regression test that reproduces this revert (Phase 1 repair)",
          "Simulate the patched call on a fork before any live broadcast",
        ]
      : [
          "Label the `from` / `to` wallets in Project Memory",
          "Watch for unlimited Approvals in the log list",
          "Open related contract source when a repo is connected",
        ];

  return {
    dataSource: "rpc",
    mode: "live_read",
    chainId,
    hash: normalized,
    status,
    blockNumber: r.blockNumber.toString(),
    from: (tx?.from ?? r.from).toLowerCase(),
    to: (tx?.to ?? r.to)?.toLowerCase() ?? null,
    valueEth,
    gasUsed: r.gasUsed.toString(),
    effectiveGasPrice: r.effectiveGasPrice?.toString() ?? null,
    revertReason,
    summary,
    assetMovements,
    logs: logs.slice(0, 40),
    risks: risksFromReceipt(r, valueEth),
    nextSteps,
  };
}

function emptyInspection(
  chainId: number,
  hash: string,
  status: TxInspection["status"],
  summary: string,
): TxInspection {
  return {
    dataSource: "rpc",
    mode: "live_read",
    chainId,
    hash,
    status,
    blockNumber: null,
    from: null,
    to: null,
    valueEth: null,
    gasUsed: null,
    effectiveGasPrice: null,
    revertReason: null,
    summary,
    assetMovements: [],
    logs: [],
    risks: [],
    nextSteps: [],
  };
}

/** Stub repair proposal — real codegen lands when repo mapping is wired. */
export function proposeRepair(inspection: TxInspection): {
  title: string;
  proposedPatch: string;
  testSketch: string;
  simulationGate: string;
  mode: "simulation";
} {
  const reason = inspection.revertReason ?? "unknown revert";
  return {
    title: `Repair for ${inspection.hash.slice(0, 10)}…`,
    proposedPatch: [
      "// Vane proposed patch (simulation mode — not applied)",
      `// Revert: ${reason}`,
      "// 1. Guard the failing path before any value transfer",
      "// 2. Revert early with a typed custom error",
      "// 3. Add an allowlist check for destination wallets",
      "",
      "function execute() external {",
      "    // require(destinationVerified(to), DestinationUnverified());",
      "    // ... existing logic",
      "}",
    ].join("\n"),
    testSketch: [
      "// Forge / Hardhat sketch",
      `// fork block: ${inspection.blockNumber ?? "latest"}`,
      "it('reproduces the revert then passes after guard', async () => {",
      "  // 1) Replay original calldata on fork — expect revert",
      "  // 2) Apply patch",
      "  // 3) Replay — expect success + correct balances",
      "});",
    ].join("\n"),
    simulationGate:
      "Fork simulation required before live mode. Vane will never broadcast without an explicit approval gate.",
    mode: "simulation",
  };
}
