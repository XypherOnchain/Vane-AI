import type { AgentAnswer, TokenOverview, WalletDna } from "@vane/shared-types";
import { formatPct, formatUsd, shortAddress } from "@vane/shared-types";

export interface AgentContext {
  getToken: (address: string) => TokenOverview | null;
  getWallet: (address: string) => WalletDna | null;
  webUrl: string;
}

function extractAddress(q: string): string | null {
  const m = q.match(/0x[a-fA-F0-9]{40}/);
  return m ? m[0]!.toLowerCase() : null;
}

export function runAgent(question: string, ctx: AgentContext, focusToken?: string): AgentAnswer {
  const q = question.toLowerCase();
  const addr = extractAddress(question) ?? focusToken?.toLowerCase() ?? null;
  const toolsUsed: string[] = [];
  const citations: AgentAnswer["citations"] = [];

  if (!addr) {
    return {
      answer:
        "Paste a token or wallet address with your question so Vane can pull deterministic evidence.",
      citations: [],
      toolsUsed: [],
      suggestedFollowUps: ["Is this token bundled?", "What is the biggest risk?"],
    };
  }

  const token = ctx.getToken(addr);
  const wallet = ctx.getWallet(addr);

  if (wallet && (!token || token.address !== addr)) {
    toolsUsed.push("get_wallet_profile");
    citations.push({ label: `Wallet ${shortAddress(addr)}`, href: `${ctx.webUrl}/wallet/${addr}` });
    return {
      answer: `**Wallet DNA: ${wallet.dnaClass}**\n\nMedian entry ${wallet.medianEntryMinutes}m · hold ${wallet.medianHoldMinutes}m · ${wallet.completedWins}/${wallet.completedTotal} wins. ${wallet.recentBehaviorNote}`,
      citations,
      toolsUsed,
      suggestedFollowUps: ["Show associated cluster"],
    };
  }

  if (!token) {
    return {
      answer: `No indexed intelligence for ${shortAddress(addr)} yet.`,
      citations: [],
      toolsUsed: [],
      suggestedFollowUps: ["Open Radar"],
    };
  }

  toolsUsed.push("get_token_overview");
  citations.push({ label: `${token.symbol} Scan`, href: `${ctx.webUrl}/token/${token.address}` });

  if (q.includes("bundl") || q.includes("cluster") || q.includes("connected")) {
    toolsUsed.push("get_token_clusters");
    citations.push({
      label: "Graph evidence",
      href: `${ctx.webUrl}/graph/${token.address}`,
      evidenceId: token.cluster?.evidenceIds[0],
    });
    if (!token.cluster) {
      return {
        answer: `No probable coordinated cluster detected. Probable connected supply: ${formatPct(token.probableConnectedSupplyPct)}.`,
        citations,
        toolsUsed,
        suggestedFollowUps: ["What is the Integrity Score?"],
      };
    }
    const c = token.cluster;
    return {
      answer: `**${c.classification.replaceAll("_", " ")} — ${Math.round(c.confidence * 100)}% confidence**\n\nConfirmed connected supply ${formatPct(c.confirmedSupplyPct)} · Probable ${formatPct(c.probableSupplyPct)}. ${c.walletCount} wallets. Shared funding: ${c.signals.sharedFunding}. Same-block: ${c.signals.sameBlock}. This is inferred from on-chain evidence — not proof of common ownership.`,
      citations,
      toolsUsed,
      suggestedFollowUps: ["What is the biggest risk?", "Did the developer sell?"],
    };
  }

  if (q.includes("score") || q.includes("risk") || q.includes("safe")) {
    toolsUsed.push("get_token_scores");
    return {
      answer: `**Integrity ${token.integrity.total}/100** · **Momentum ${token.momentum.total}/100** · **Data confidence ${token.dataConfidence.level}**.\n\nBiggest observable risk: distribution / connected supply. ${token.summary}`,
      citations: [
        ...citations,
        { label: "Evidence graph", href: `${ctx.webUrl}/graph/${token.address}` },
      ],
      toolsUsed,
      suggestedFollowUps: ["Is this token bundled?"],
    };
  }

  if (q.includes("dev") || q.includes("deployer")) {
    toolsUsed.push("get_developer_history");
    return {
      answer: `Deployer ${shortAddress(token.deployer)}${token.deployerFunding ? ` funded by ${shortAddress(token.deployerFunding)}` : ""}. Launchpad: ${token.launchpad ?? "unknown"}.`,
      citations,
      toolsUsed,
      suggestedFollowUps: ["Did the developer sell?"],
    };
  }

  return {
    answer: `**Vane Intelligence — $${token.symbol}**\n\n${token.summary}\n\nIntegrity ${token.integrity.total} · Momentum ${token.momentum.total} · Mcap ${formatUsd(token.marketCapUsd)} · Liq ${formatUsd(token.liquidityUsd)}`,
    citations: [
      ...citations,
      { label: "Open graph", href: `${ctx.webUrl}/graph/${token.address}` },
    ],
    toolsUsed,
    suggestedFollowUps: ["Is this token bundled?", "What is the biggest risk?"],
  };
}

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
              "Rewrite for clarity only. Do not add blockchain facts or numbers not already present.",
          },
          { role: "user", content: answer.answer },
        ],
      }),
    });
    if (!res.ok) return answer;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text ? { ...answer, answer: text } : answer;
  } catch {
    return answer;
  }
}
