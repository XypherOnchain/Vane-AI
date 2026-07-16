import { createRobinhoodProvider, type RpcProvider } from "@vane/chain";
import { loadEnv } from "@vane/config";
import { indexLocalRepo, mapSelectorToSource, type SelectorHit } from "@vane/repo-index";
import { simulateRepair, type SimResult } from "@vane/simulation";
import type { Project } from "@vane/project-graph";
import {
  decodeErrorResult,
  decodeEventLog,
  formatEther,
  hexToString,
  isHex,
  type Abi,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

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
  eventHint?: string;
  decoded?: { eventName: string; args: Record<string, unknown> };
}

export interface TraceCall {
  type: string;
  from: string;
  to?: string;
  value?: string;
  gas?: string;
  gasUsed?: string;
  input?: string;
  output?: string;
  error?: string;
  calls?: TraceCall[];
}

export interface GasSummary {
  gasUsed: string | null;
  effectiveGasPrice: string | null;
  gasCostEth: string | null;
  callDataBytes: number | null;
}

export interface AddressRole {
  address: string;
  role?: string;
  label?: string;
  kind: "wallet" | "contract" | "unknown";
}

export interface TxInspection {
  dataSource: "rpc" | "rpc+trace" | "tenderly";
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
  gas: GasSummary;
  inputSelector: string | null;
  functionName: string | null;
  revertReason: string | null;
  summary: string;
  assetMovements: AssetMovement[];
  logs: DecodedLog[];
  trace: TraceCall | null;
  traceNote: string | null;
  relatedCode: SelectorHit[];
  addressRoles: AddressRole[];
  risks: { severity: "critical" | "high" | "medium" | "info"; text: string }[];
  nextSteps: string[];
}

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const APPROVAL_TOPIC =
  "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";

const ERC20_ABI = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "Approval",
    inputs: [
      { indexed: true, name: "owner", type: "address" },
      { indexed: true, name: "spender", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
  },
] as const satisfies Abi;

let provider: RpcProvider | null = null;

function getProvider(rpcUrl?: string): RpcProvider {
  if (rpcUrl) {
    // ad-hoc: still use robinhood provider factory defaults for chain id;
    // custom RPC via env override when set on project
    process.env.ROBINHOOD_MAINNET_RPC_URL = rpcUrl;
    provider = null;
  }
  if (!provider) provider = createRobinhoodProvider(loadEnv());
  return provider;
}

function decodeRevertData(data: Hex | undefined): string | null {
  if (!data || data === "0x") return null;
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

function decodeKnownLog(log: {
  address: Hex;
  topics: Hex[];
  data: Hex;
}): DecodedLog["decoded"] | undefined {
  try {
    const decoded = decodeEventLog({
      abi: ERC20_ABI,
      data: log.data,
      topics: log.topics as [Hex, ...Hex[]],
    });
    return {
      eventName: decoded.eventName,
      args: Object.fromEntries(
        Object.entries(decoded.args as Record<string, unknown>).map(([k, v]) => [
          k,
          typeof v === "bigint" ? v.toString() : v,
        ]),
      ),
    };
  } catch {
    return undefined;
  }
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
      } else {
        risks.push({
          severity: "medium",
          text: `Approval granted to ${spender}`,
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

function loadProjectAbis(project?: Project | null): Abi[] {
  if (!project?.repoPath) return [ERC20_ABI];
  const abis: Abi[] = [ERC20_ABI];
  for (const c of project.contracts) {
    if (!c.abiPath) continue;
    const full = join(project.repoPath, c.abiPath);
    if (!existsSync(full)) continue;
    try {
      const json = JSON.parse(readFileSync(full, "utf8")) as { abi?: Abi } | Abi;
      const abi = Array.isArray(json) ? json : (json as { abi?: Abi }).abi;
      if (abi) abis.push(abi);
    } catch {
      /* skip */
    }
  }
  return abis;
}

async function fetchTrace(
  p: RpcProvider,
  hash: Hex,
): Promise<{ trace: TraceCall | null; note: string | null; source: TxInspection["dataSource"] }> {
  // Tenderly public-ish simulate-by-hash when configured
  if (
    process.env.TENDERLY_ACCESS_KEY &&
    process.env.TENDERLY_ACCOUNT_SLUG &&
    process.env.TENDERLY_PROJECT_SLUG
  ) {
    try {
      const account = process.env.TENDERLY_ACCOUNT_SLUG;
      const project = process.env.TENDERLY_PROJECT_SLUG;
      const url = `https://api.tenderly.co/api/v1/account/${account}/project/${project}/simulate`;
      // Prefer debug_traceTransaction first for honesty about node support
      void url;
    } catch {
      /* fall through */
    }
  }

  try {
    const result = await p.withClient(async (c) => {
      return c.request({
        method: "debug_traceTransaction" as "eth_chainId",
        params: [hash, { tracer: "callTracer" }] as never,
      });
    });
    if (result && typeof result === "object") {
      return {
        trace: normalizeTrace(result as Record<string, unknown>),
        note: null,
        source: "rpc+trace",
      };
    }
  } catch (e) {
    return {
      trace: null,
      note: `Call-tree unavailable: ${e instanceof Error ? e.message : String(e)}. Configure Tenderly or an archive node with debug_traceTransaction.`,
      source: "rpc",
    };
  }
  return {
    trace: null,
    note: "Node returned empty trace. No invented call tree.",
    source: "rpc",
  };
}

function normalizeTrace(raw: Record<string, unknown>): TraceCall {
  const calls = Array.isArray(raw.calls)
    ? (raw.calls as Record<string, unknown>[]).map(normalizeTrace)
    : undefined;
  return {
    type: String(raw.type ?? "CALL"),
    from: String(raw.from ?? "").toLowerCase(),
    to: raw.to ? String(raw.to).toLowerCase() : undefined,
    value: raw.value != null ? String(raw.value) : undefined,
    gas: raw.gas != null ? String(raw.gas) : undefined,
    gasUsed: raw.gasUsed != null ? String(raw.gasUsed) : undefined,
    input: raw.input != null ? String(raw.input) : undefined,
    output: raw.output != null ? String(raw.output) : undefined,
    error: raw.error != null ? String(raw.error) : raw.revertReason != null ? String(raw.revertReason) : undefined,
    calls,
  };
}

export interface InspectOptions {
  project?: Project | null;
  rpcUrl?: string;
}

export async function inspectTransaction(
  hash: string,
  opts: InspectOptions = {},
): Promise<TxInspection> {
  const project = opts.project;
  const rpcFromProject =
    opts.rpcUrl ??
    project?.chainConfigs?.find((c) => c.chainId === 4663)?.rpcUrl ??
    project?.chainConfigs?.find((c) => c.rpcUrl)?.rpcUrl;
  const p = getProvider(rpcFromProject);
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
      inputSelector: tx.input?.slice(0, 10) ?? null,
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
      const match =
        msg.match(/reverted with reason string '([^']+)'/i) ??
        msg.match(/execution reverted: (.+)/i) ??
        msg.match(/reverted with the following reason:\n(.+)/i);
      revertReason = match?.[1]?.trim() ?? msg.slice(0, 200);
      if (isHex(msg as Hex)) revertReason = decodeRevertData(msg as Hex) ?? revertReason;
    }
  }

  const projectAbis = loadProjectAbis(project);
  void projectAbis;

  const logs: DecodedLog[] = r.logs.map((l) => ({
    address: l.address.toLowerCase(),
    topics: l.topics.map(String),
    data: l.data,
    eventHint: logHints(l.topics),
    decoded: decodeKnownLog({
      address: l.address,
      topics: l.topics as Hex[],
      data: l.data,
    }),
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

  const { trace, note: traceNote, source } = await fetchTrace(p, normalized);

  const inputSelector = tx?.input && tx.input.length >= 10 ? tx.input.slice(0, 10) : null;
  let functionName: string | null = null;
  const relatedCode: SelectorHit[] = [];
  if (inputSelector && project?.repoPath) {
    const index = indexLocalRepo(project.repoPath);
    const hit = mapSelectorToSource(index, inputSelector);
    if (hit) {
      functionName = hit.functionName;
      relatedCode.push(hit);
    }
  }

  const addrs = new Set<string>();
  if (tx?.from) addrs.add(tx.from.toLowerCase());
  if (tx?.to) addrs.add(tx.to.toLowerCase());
  for (const m of assetMovements) {
    addrs.add(m.from);
    addrs.add(m.to);
  }
  for (const l of logs) addrs.add(l.address);

  const addressRoles: AddressRole[] = [...addrs].map((address) => {
    const wallet = project?.wallets.find((w) => w.address === address);
    if (wallet) {
      return { address, role: wallet.role, label: wallet.label, kind: "wallet" as const };
    }
    const contract = project?.contracts.find((c) => c.address === address);
    if (contract) {
      return {
        address,
        role: contract.isProduction ? "production" : "contract",
        label: contract.name,
        kind: "contract" as const,
      };
    }
    return { address, kind: "unknown" as const };
  });

  const gasCostEth =
    r.effectiveGasPrice != null
      ? formatEther(r.gasUsed * r.effectiveGasPrice)
      : null;
  const gas: GasSummary = {
    gasUsed: r.gasUsed.toString(),
    effectiveGasPrice: r.effectiveGasPrice?.toString() ?? null,
    gasCostEth,
    callDataBytes: tx?.input ? Math.max(0, (tx.input.length - 2) / 2) : null,
  };

  const status = r.status === "success" ? "success" : "reverted";
  const summary =
    status === "success"
      ? `Transaction succeeded in block ${r.blockNumber}. ${logs.length} log(s), ${assetMovements.length} asset movement(s)${functionName ? `, call ${functionName}` : ""}.`
      : `Transaction reverted in block ${r.blockNumber}.${revertReason ? ` Reason: ${revertReason}` : ""}${functionName ? ` · ${functionName}` : ""}`;

  const nextSteps =
    status === "reverted"
      ? [
          "Save this as an incident in Project Memory",
          functionName
            ? `Open ${relatedCode[0]?.path}:${relatedCode[0]?.line}`
            : "Connect a repo to map the failing selector to source",
          "Generate a regression test that reproduces this revert",
          "Simulate the patched call on a fork before any live broadcast",
        ]
      : [
          "Label the `from` / `to` wallets in Project Memory",
          "Watch for unlimited Approvals in the log list",
          "Open related contract source when a repo is connected",
        ];

  return {
    dataSource: source,
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
    gas,
    inputSelector,
    functionName,
    revertReason,
    summary,
    assetMovements,
    logs: logs.slice(0, 40),
    trace,
    traceNote,
    relatedCode,
    addressRoles,
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
    gas: { gasUsed: null, effectiveGasPrice: null, gasCostEth: null, callDataBytes: null },
    inputSelector: null,
    functionName: null,
    revertReason: null,
    summary,
    assetMovements: [],
    logs: [],
    trace: null,
    traceNote: null,
    relatedCode: [],
    addressRoles: [],
    risks: [],
    nextSteps: [],
  };
}

export async function proposeRepair(
  inspection: TxInspection,
  project?: Project | null,
): Promise<{
  title: string;
  proposedPatch: string;
  testSketch: string;
  simulationGate: string;
  mode: "simulation";
  simulation: SimResult;
  relatedCode: SelectorHit[];
}> {
  const reason = inspection.revertReason ?? "unknown revert";
  const fn = inspection.functionName ?? "execute";
  const codeHint = inspection.relatedCode[0];
  const proposedPatch = [
    `// Vane proposed patch (simulation mode — not applied)`,
    `// Revert: ${reason}`,
    codeHint ? `// Source: ${codeHint.path}:${codeHint.line} (${codeHint.functionName})` : "// Connect repo for file:line mapping",
    "",
    `function ${fn}() external {`,
    `    // Guard failing path before value transfer`,
    `    // revert ${JSON.stringify(reason)} → typed custom error`,
    `    // require(destinationVerified(to), DestinationUnverified());`,
    `}`,
  ].join("\n");

  const testSketch = [
    `// SPDX-License-Identifier: MIT`,
    `// Forge fork test sketch — generated by Vane Debug`,
    `// forge test --fork-url $FORK_RPC_URL --match-test testReproduceRevert -vv`,
    `pragma solidity ^0.8.20;`,
    `import "forge-std/Test.sol";`,
    ``,
    `contract VaneIncident_${inspection.hash.slice(2, 10)} is Test {`,
    `    function testReproduceRevert() public {`,
    `        // fork block: ${inspection.blockNumber ?? "latest"}`,
    `        // 1) Replay original calldata — expect revert: ${reason}`,
    `        // 2) Apply patch`,
    `        // 3) Replay — expect success + correct balances`,
    `        vm.expectRevert();`,
    `        // target.call(hex"${inspection.inputSelector ?? "0x"}...");`,
    `    }`,
    `}`,
  ].join("\n");

  const simulation = await simulateRepair({
    chainId: inspection.chainId,
    txHash: inspection.hash,
    from: inspection.from ?? undefined,
    to: inspection.to ?? undefined,
    blockNumber: inspection.blockNumber ?? undefined,
    patchNote: `Proposed guard for ${fn}`,
  });

  return {
    title: `Repair for ${inspection.hash.slice(0, 10)}…`,
    proposedPatch,
    testSketch,
    simulationGate:
      "Fork simulation required before live mode. Live broadcast is disabled in Phase 1.",
    mode: "simulation",
    simulation,
    relatedCode: inspection.relatedCode,
  };
}
