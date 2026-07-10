import type { AgentAnswer, TokenScan, WalletDna } from "@vane/shared";
import { formatPct, formatUsd, shortAddress } from "@vane/shared";

export type AgentToolName =
  | "get_token_scan"
  | "get_cluster"
  | "get_wallet_dna"
  | "get_score"
  | "get_developer_history";

export interface AgentContext {
  getToken: (address: string) => TokenScan | null;
  getWallet: (address: string) => WalletDna | null;
  webUrl: string;
}

function extractAddress(q: string): string | null {
  const m = q.match(/0x[a-fA-F0-9]{40}/);
  return m ? m[0].toLowerCase() : null;
}

/** Deterministic agent: maps NL → tools → cited answer. Never invents chain facts. */
export function runAgent(question: string, ctx: AgentContext, focusToken?: string): AgentAnswer {
  const q = question.toLowerCase();
  const addr = extractAddress(question) ?? focusToken?.toLowerCase() ?? null;
  const toolsUsed: AgentToolName[] = [];
  const citations: AgentAnswer["citations"] = [];

  if (!addr) {
    return {
      answer:
        "Paste a token or wallet address with your question so Vane can pull deterministic evidence.",
      citations: [],
      toolsUsed: [],
      suggestedFollowUps: [
        "Is this token bundled?",
        "What is the biggest risk?",
        "Did the developer sell?",
      ],
    };
  }

  const token = ctx.getToken(addr);
  const wallet = ctx.getWallet(addr);

  if (wallet && !token?.symbol) {
    toolsUsed.push("get_wallet_dna");
    citations.push({
      label: `Wallet ${shortAddress(addr)}`,
      href: `${ctx.webUrl}/wallet/${addr}`,
    });
    return {
      answer: `**Wallet DNA: ${wallet.dnaClass}**\n\nMedian entry: ${wallet.medianEntryMinutes} minutes after launch. Median position: ${wallet.medianPositionEth} ETH. Median hold: ${wallet.medianHoldMinutes} minutes. Completed profitable positions: ${wallet.completedWins} of ${wallet.completedTotal}. Frequently trades with a ${wallet.associatedClusterSize}-wallet cluster. ${wallet.recentBehaviorNote}`,
      citations,
      toolsUsed,
      suggestedFollowUps: [
        "Which tokens has this wallet traded recently?",
        "Show associated cluster",
      ],
    };
  }

  if (!token) {
    return {
      answer: `No indexed intelligence for ${shortAddress(addr)} yet. Vane is still indexing or the address is unknown.`,
      citations: [],
      toolsUsed: [],
      suggestedFollowUps: ["Scan this token on Radar", "Check back after indexing"],
    };
  }

  toolsUsed.push("get_token_scan");
  citations.push({
    label: `${token.symbol} Scan`,
    href: `${ctx.webUrl}/token/${token.address}`,
  });

  if (q.includes("bundl") || q.includes("cluster") || q.includes("connected")) {
    toolsUsed.push("get_cluster");
    citations.push({
      label: "Holder graph",
      href: `${ctx.webUrl}/graph/${token.address}`,
    });
    if (!token.cluster) {
      return {
        answer: `No probable coordinated cluster detected for **$${token.symbol}** with current evidence. Connected supply estimate: ${formatPct(token.connectedSupplyPct)}.`,
        citations,
        toolsUsed,
        suggestedFollowUps: ["Show top holders", "What is the Vane Score?"],
      };
    }
    const c = token.cluster;
    return {
      answer: `**Probable Coordinated Cluster — ${Math.round(c.confidence * 100)}% confidence**\n\nShared funding: ${c.signals.sharedFunding}. Same-block activity: ${c.signals.sameBlock}. Similar sizing: ${c.signals.similarSizing}. Historical coordination: ${c.signals.historicalCoordination}. Common exit: ${c.signals.commonExit}.\n\n${c.walletCount} wallets control ~${formatPct(c.supplyPct)} of supply. This is inferred from on-chain evidence — not proof of common ownership.`,
      citations,
      toolsUsed,
      suggestedFollowUps: [
        "What is the biggest risk?",
        "Monitor this cluster if it sells",
        "Show developer history",
      ],
    };
  }

  if (q.includes("score") || q.includes("safe") || q.includes("risk")) {
    toolsUsed.push("get_score");
    const s = token.vaneScore;
    const biggest =
      s.distribution <= 10
        ? "distribution / connected supply"
        : s.developerHistory <= 8
          ? "developer history"
          : s.liquidityQuality <= 10
            ? "liquidity quality"
            : "market integrity";
    return {
      answer: `**Vane Score: ${s.total}/100** (explainable, not a promise of safety).\n\nContract Integrity ${s.contractIntegrity}/20 · Distribution ${s.distribution}/20 · Developer History ${s.developerHistory}/15 · Liquidity ${s.liquidityQuality}/15 · Market ${s.marketIntegrity}/10 · Wallets ${s.walletQuality}/10 · Momentum ${s.momentum}/10.\n\n**Biggest observable risk:** ${biggest}. ${token.summary.split(".").slice(0, 2).join(".")}.`,
      citations: [
        ...citations,
        { label: "Evidence graph", href: `${ctx.webUrl}/graph/${token.address}` },
      ],
      toolsUsed,
      suggestedFollowUps: ["Is this token bundled?", "Create a cluster-sell alert"],
    };
  }

  if (q.includes("dev") || q.includes("deployer") || q.includes("creator")) {
    toolsUsed.push("get_developer_history");
    const launches = token.previousLaunches
      .map((l) => `$${l.symbol} ATH ${formatUsd(l.athFdvUsd)} → ${l.outcomePct}%`)
      .join("; ");
    return {
      answer: `Deployer ${shortAddress(token.deployer)}${token.deployerFunding ? ` funded by ${shortAddress(token.deployerFunding)}` : ""}. Previous launches: ${launches || "none indexed"}. Current developer holdings appear in top holders when present.`,
      citations,
      toolsUsed,
      suggestedFollowUps: ["Did the developer sell?", "Compare previous launches"],
    };
  }

  if (q.includes("sell") && q.includes("dev")) {
    return {
      answer:
        token.topHolders.some((h) => h.address === token.deployer && h.pctSupply > 0)
          ? `Deployer still holds ~${formatPct(token.topHolders.find((h) => h.address === token.deployer)?.pctSupply ?? 0)}. No confirmed full developer exit in the latest snapshot.`
          : `Deployer is not in the current top-holder set. Check the live graph for recent transfers.`,
      citations: [
        ...citations,
        { label: "Graph", href: `${ctx.webUrl}/graph/${token.address}` },
      ],
      toolsUsed,
      suggestedFollowUps: ["Monitor developer wallet", "Show cluster activity"],
    };
  }

  return {
    answer: `**Vane Intelligence Summary — $${token.symbol}**\n\n${token.summary}\n\n**Confidence:** ${token.cluster ? `${Math.round(token.cluster.confidence * 100)}%` : "n/a"} · **Vane Score:** ${token.vaneScore.total}/100 · **Mcap:** ${formatUsd(token.marketCapUsd)} · **Liq:** ${formatUsd(token.liquidityUsd)}`,
    citations: [
      ...citations,
      { label: "Open graph", href: `${ctx.webUrl}/graph/${token.address}` },
    ],
    toolsUsed,
    suggestedFollowUps: [
      "Is this token bundled?",
      "What is the biggest risk?",
      "Who funded the developer?",
    ],
  };
}

/** Optional LLM polish — only rewrites structure; facts come from tools */
export async function maybePolishWithLlm(
  answer: AgentAnswer,
  apiKey?: string,
  model = "gpt-4o-mini",
): Promise<AgentAnswer> {
  if (!apiKey) return answer;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are Vane. Rewrite the user content for clarity only. Do not add blockchain facts, numbers, or claims that are not already present. Keep markdown.",
          },
          { role: "user", content: answer.answer },
        ],
      }),
    });
    if (!res.ok) return answer;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return answer;
    return { ...answer, answer: text };
  } catch {
    return answer;
  }
}
