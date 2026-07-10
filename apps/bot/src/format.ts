import {
  formatPct,
  formatUsd,
  isLikelyAddress,
  shortAddress,
  type TokenScan,
} from "@vane/shared";

const apiUrl = () => process.env.API_URL ?? "http://localhost:4000";
const webUrl = () => process.env.WEB_URL ?? "http://localhost:3000";

export async function fetchToken(address: string): Promise<TokenScan | null> {
  const res = await fetch(`${apiUrl()}/v1/tokens/${address}`);
  if (!res.ok) return null;
  return (await res.json()) as TokenScan;
}

export async function fetchRadar() {
  const res = await fetch(`${apiUrl()}/v1/radar`);
  if (!res.ok) return [];
  const data = (await res.json()) as { items: TokenScan[] | unknown[] };
  return data.items ?? [];
}

export async function askAgent(question: string, tokenAddress?: string) {
  const res = await fetch(`${apiUrl()}/v1/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, tokenAddress }),
  });
  if (!res.ok) return null;
  return (await res.json()) as {
    answer: string;
    citations: { label: string; href: string }[];
  };
}

export async function createAlert(input: {
  kind: string;
  tokenAddress: string;
  telegramChatId: string;
}) {
  const res = await fetch(`${apiUrl()}/v1/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function createReport(tokenAddress: string) {
  const res = await fetch(`${apiUrl()}/v1/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tokenAddress }),
  });
  if (!res.ok) return null;
  return (await res.json()) as { url: string; id: string };
}

/** Rick-density investigation card */
export function formatScanCard(t: TokenScan): string {
  const th = t.topHolders
    .slice(0, 5)
    .map((h) => h.pctSupply.toFixed(1))
    .join(" · ");
  const tags = t.securityTags.join(" ");
  const cluster = t.cluster
    ? `\n🧬 Cluster ${Math.round(t.cluster.confidence * 100)}% · ${formatPct(t.cluster.supplyPct)} connected · ${t.cluster.walletCount} wallets`
    : `\n🔗 Connected supply ${formatPct(t.connectedSupplyPct)}`;

  return (
    `*$${t.symbol}* — ${t.name}\n` +
    `\`${t.address}\`\n` +
    `Robinhood Chain · Vane Score *${t.vaneScore.total}/100*\n\n` +
    `💵 ${formatUsd(t.priceUsd, 8)}  ·  FDV ${formatUsd(t.fdvUsd)}` +
    (t.athMinutesAgo != null ? `  ·  ATH ${formatUsd(t.athFdvUsd)} (${t.athMinutesAgo}m ago)` : "") +
    `\n💧 Liq ${formatUsd(t.liquidityUsd)}  ·  Vol ${formatUsd(t.volumeUsd)}  ·  Age ${t.ageMinutes}m\n` +
    `📈 ${t.buys1h} buys / ${t.sells1h} sells  ·  Holders ${t.holders}  ·  Fresh ${formatPct(t.freshWalletPct)}\n` +
    `👥 TH ${th}  ·  Σ top5 visible\n` +
    `🏷 ${tags}` +
    cluster +
    `\n\n${t.summary.slice(0, 320)}${t.summary.length > 320 ? "…" : ""}\n\n` +
    `🔗 [Scan](${webUrl()}/token/${t.address}) · [Graph](${webUrl()}/graph/${t.address}) · [Radar](${webUrl()}/radar)`
  );
}

export function extractAddress(text: string): string | null {
  const m = text.match(/0x[a-fA-F0-9]{40}/);
  if (m) return m[0].toLowerCase();
  // bare 40-hex without 0x
  const bare = text.match(/\b([a-fA-F0-9]{40})\b/);
  if (bare) return `0x${bare[1].toLowerCase()}`;
  return null;
}

export function helpText(): string {
  return (
    `👋 *Vane* — live intelligence for Robinhood Chain.\n\n` +
    `Paste any contract to scan, or use:\n` +
    `/vane <token> — full intelligence card\n` +
    `/graph <token> — open holder graph\n` +
    `/wallet <address> — Wallet DNA\n` +
    `/dev <token> — developer history\n` +
    `/cluster <token> — connected supply / bundle\n` +
    `/watch <token> — alert on cluster selling\n` +
    `/new · /trending — Radar feed\n` +
    `/ask <question> — evidence-backed answers\n` +
    `/report <token> — shareable investigation\n` +
    `/commands — cheatsheet\n\n` +
    `Vane explains what is happening, shows evidence, and monitors what matters.`
  );
}

void isLikelyAddress;
void shortAddress;
