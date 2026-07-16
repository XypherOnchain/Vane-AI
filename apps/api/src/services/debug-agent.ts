import { indexLocalRepo, searchRepoIndex } from "@vane/repo-index";
import type { Project } from "@vane/project-graph";
import { inspectTransaction, proposeRepair } from "./tx-inspector.js";
import type { ProjectStoreFacade } from "./project-store.js";

export interface DebugCitation {
  label: string;
  href?: string;
  kind: "tx" | "file" | "incident" | "project";
}

export interface DebugAgentAnswer {
  answer: string;
  citations: DebugCitation[];
  toolsUsed: string[];
  suggestedFollowUps: string[];
  redacted: boolean;
}

const SECRET_PATTERNS = [
  /(?:private[_\s-]?key|secret|api[_\s-]?key|mnemonic|seed)\s*[:=]\s*\S+/gi,
  /\b(0x[a-fA-F0-9]{64})\b/g,
  /\b([a-zA-Z0-9_-]{20,}:AA[a-zA-Z0-9_-]{20,})\b/g,
];

export function redactSecrets(text: string): { text: string; redacted: boolean } {
  let out = text;
  let redacted = false;
  for (const re of SECRET_PATTERNS) {
    const next = out.replace(re, "[REDACTED]");
    if (next !== out) redacted = true;
    out = next;
  }
  // Never echo env values — only names are allowed in prompts
  out = out.replace(/(process\.env\.)([A-Z0-9_]+)\s*=\s*["'][^"']+["']/g, "$1$2=[REDACTED]");
  return { text: out, redacted };
}

function extractTxHash(q: string): string | null {
  const m = q.match(/0x[a-fA-F0-9]{64}/);
  return m ? m[0]!.toLowerCase() : null;
}

export async function runDebugAgent(
  question: string,
  opts: {
    store: ProjectStoreFacade;
    projectId?: string;
    webUrl: string;
  },
): Promise<DebugAgentAnswer> {
  const { text: safeQ, redacted } = redactSecrets(question);
  const toolsUsed: string[] = [];
  const citations: DebugCitation[] = [];
  const project =
    opts.projectId ? await opts.store.getProject(opts.projectId) : (await opts.store.listProjects())[0];

  const txHash = extractTxHash(safeQ);
  const q = safeQ.toLowerCase();

  // Tool: get_project
  if (q.includes("project") || q.includes("workspace") || q.includes("what do we have")) {
    toolsUsed.push("get_project");
    if (!project) {
      return {
        answer: "No project in memory yet. Create one in Workspace (Screen 1).",
        citations,
        toolsUsed,
        suggestedFollowUps: ["Create a project with Robinhood Chain RPC"],
        redacted,
      };
    }
    citations.push({
      label: `Project ${project.name}`,
      href: `${opts.webUrl}/debug`,
      kind: "project",
    });
    return {
      answer: [
        `**${project.name}**`,
        `Repo: ${project.githubUrl || project.repoPath || "not connected"}`,
        `Chains: ${project.chains.join(", ")}`,
        `Wallets: ${project.wallets.length} · Contracts: ${project.contracts.length}`,
        `Telegram: ${project.telegramChatId || "not set"}`,
        `Env names (values never sent to AI): ${project.envVarNames.map((e) => e.name).join(", ") || "none"}`,
      ].join("\n"),
      citations,
      toolsUsed,
      suggestedFollowUps: ["Why did this fail?", "List incidents"],
      redacted,
    };
  }

  // Tool: list_incidents
  if (q.includes("incident")) {
    toolsUsed.push("list_incidents");
    const items = await opts.store.listIncidents(project?.id);
    for (const i of items.slice(0, 5)) {
      citations.push({
        label: `Incident ${i.id.slice(0, 8)}`,
        href: i.txHash ? `${opts.webUrl}/debug/tx?hash=${i.txHash}` : undefined,
        kind: "incident",
      });
    }
    return {
      answer:
        items.length === 0
          ? "No incidents saved yet."
          : items
              .slice(0, 8)
              .map(
                (i) =>
                  `- [${i.status}] ${i.title}${i.txHash ? ` · tx \`${i.txHash.slice(0, 10)}…\`` : ""} (id: ${i.id})`,
              )
              .join("\n"),
      citations,
      toolsUsed,
      suggestedFollowUps: ["Why did this fail?", "Propose a repair"],
      redacted,
    };
  }

  // Tool: search_repo
  if ((q.includes("search") || q.includes("where is") || q.includes("find ")) && project?.repoPath) {
    toolsUsed.push("search_repo");
    const index = indexLocalRepo(project.repoPath);
    const term =
      safeQ.replace(/search|where is|find|in (the )?repo/gi, "").trim() || "function";
    const hits = searchRepoIndex(index, term, 10);
    for (const h of hits.slice(0, 5)) {
      citations.push({ label: h.path, kind: "file" });
    }
    return {
      answer:
        hits.length === 0
          ? `No matches for “${term}” in ${project.repoPath}.`
          : hits.map((h) => `- \`${h.path}\` (${h.kind})`).join("\n"),
      citations,
      toolsUsed,
      suggestedFollowUps: ["Explain this call path", "Inspect a failed tx"],
      redacted,
    };
  }

  // Tool: propose_repair
  if (q.includes("repair") || q.includes("patch") || q.includes("fix")) {
    if (!txHash) {
      return {
        answer: "Paste a transaction hash to propose a repair.",
        citations,
        toolsUsed,
        suggestedFollowUps: ["Inspect 0x…"],
        redacted,
      };
    }
    toolsUsed.push("inspect_tx", "propose_repair");
    const inspection = await inspectTransaction(txHash, { project });
    const repair = await proposeRepair(inspection, project);
    citations.push({
      label: `tx ${txHash.slice(0, 10)}…`,
      href: `${opts.webUrl}/debug/tx?hash=${txHash}`,
      kind: "tx",
    });
    for (const c of repair.relatedCode) {
      citations.push({ label: `${c.path}:${c.line}`, kind: "file" });
    }
    return {
      answer: [
        `**Repair proposal** for \`${txHash}\``,
        inspection.summary,
        "",
        "```solidity",
        repair.proposedPatch,
        "```",
        "",
        `Sim (${repair.simulation.provider}): before=${repair.simulation.before.status} — ${repair.simulation.before.note}`,
        repair.simulationGate,
      ].join("\n"),
      citations,
      toolsUsed,
      suggestedFollowUps: ["Save as incident", "Open Repair screen"],
      redacted,
    };
  }

  // Tool: inspect_tx / explain_tx (default when hash present or "why")
  if (txHash || q.includes("fail") || q.includes("revert") || q.includes("why")) {
    if (!txHash) {
      return {
        answer: "Paste a tx hash (0x…) so I can inspect it with citations.",
        citations,
        toolsUsed,
        suggestedFollowUps: ["Inspect a failed transaction"],
        redacted,
      };
    }
    toolsUsed.push("inspect_tx");
    if (q.includes("explain") || q.includes("why")) toolsUsed.push("explain_tx");
    const inspection = await inspectTransaction(txHash, { project });
    citations.push({
      label: `tx ${txHash}`,
      href: `${opts.webUrl}/debug/tx?hash=${txHash}`,
      kind: "tx",
    });
    for (const c of inspection.relatedCode) {
      citations.push({ label: `${c.path}:${c.line} · ${c.functionName}`, kind: "file" });
    }
    const roles = inspection.addressRoles
      .filter((r) => r.kind !== "unknown")
      .map((r) => `${r.address.slice(0, 10)}…=${r.role ?? r.kind}`)
      .join(", ");
    return {
      answer: [
        `**${inspection.status}** on chain ${inspection.chainId}`,
        inspection.summary,
        inspection.functionName ? `Mapped call: **${inspection.functionName}**` : "No source map (connect repo in Workspace).",
        inspection.revertReason ? `Revert: \`${inspection.revertReason}\`` : null,
        roles ? `Memory roles: ${roles}` : null,
        inspection.traceNote ? `_Trace: ${inspection.traceNote}_` : null,
        "",
        "Citations above link the hash and source files.",
      ]
        .filter(Boolean)
        .join("\n"),
      citations,
      toolsUsed,
      suggestedFollowUps: ["Propose a repair", "List incidents"],
      redacted,
    };
  }

  return {
    answer:
      "Vane Debug tools: ask about a **tx hash**, **project**, **incidents**, **repo search**, or **repair**.",
    citations,
    toolsUsed,
    suggestedFollowUps: [
      "Why did 0x… fail?",
      "What is in this project?",
      "List incidents",
      "Search repo for transfer",
    ],
    redacted,
  };
}

export function projectPromptSafe(project: Project | null | undefined): string {
  if (!project) return "No project";
  return [
    `name=${project.name}`,
    `repo=${project.githubUrl || project.repoPath || ""}`,
    `chains=${project.chains.join(",")}`,
    `envNames=${project.envVarNames.map((e) => e.name).join(",")}`,
    // Never include secret values
  ].join(" | ");
}
