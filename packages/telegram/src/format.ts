import { formatPct, formatUsd, type TokenOverview } from "@vane/shared-types";

/**
 * Rick-density Telegram scan card, extracted from the legacy bot and adapted
 * to the canonical TokenOverview shape. Consumed by apps/telegram-pairs and
 * apps/telegram-intelligence — no analysis logic lives here, only formatting.
 */
export function formatScanCard(t: TokenOverview, webUrl: string): string {
  const th = t.topHolders
    .slice(0, 5)
    .map((h) => h.pctSupply.toFixed(1))
    .join(" · ");
  const cluster = t.cluster
    ? `\n🧬 Cluster ${Math.round(t.cluster.confidence * 100)}% · ${formatPct(t.probableConnectedSupplyPct)} probable connected · ${t.cluster.walletCount} wallets`
    : `\n🔗 Connected supply ${formatPct(t.connectedSupplyPct)}`;
  const demoBanner = t.dataSource === "demo" ? "⚠️ *DEMONSTRATION DATA — not live*\n" : "";

  return (
    demoBanner +
    `*$${t.symbol}* — ${t.name}\n` +
    `\`${t.address}\`\n` +
    `Robinhood Chain · Integrity *${t.integrity.total}/100* · Momentum *${t.momentum.total}/100*\n\n` +
    `💵 ${formatUsd(t.priceUsd, 8)}  ·  FDV ${formatUsd(t.fdvUsd)}` +
    (t.athMinutesAgo != null
      ? `  ·  ATH ${formatUsd(t.athFdvUsd)} (${t.athMinutesAgo}m ago)`
      : "") +
    `\n💧 Liq ${formatUsd(t.liquidityUsd)}  ·  Vol ${formatUsd(t.volume1hUsd)}  ·  Age ${t.ageMinutes}m\n` +
    `📈 ${t.buys1h} buys / ${t.sells1h} sells  ·  Holders ${t.holders}  ·  Fresh ${formatPct(t.freshWalletPct)}\n` +
    `👥 TH ${th}` +
    cluster +
    `\n\n${t.summary.slice(0, 320)}${t.summary.length > 320 ? "…" : ""}\n\n` +
    `🔗 [Scan](${webUrl}/token/${t.address}) · [Graph](${webUrl}/graph/${t.address}) · [Radar](${webUrl}/radar)`
  );
}

/** Extracts the first EVM address from free text (with or without 0x prefix). */
export function extractAddress(text: string): string | null {
  const m = text.match(/0x[a-fA-F0-9]{40}/);
  if (m) return m[0].toLowerCase();
  const bare = text.match(/\b([a-fA-F0-9]{40})\b/);
  if (bare) return `0x${bare[1]!.toLowerCase()}`;
  return null;
}

export function helpText(): string {
  return (
    `👋 *Vane* — live intelligence for Robinhood Chain.\n\n` +
    `Paste any contract to scan, or use:\n` +
    `/scan <token> — full intelligence card\n` +
    `/graph <token> — open holder graph\n` +
    `/wallet <address> — Wallet DNA\n` +
    `/dev <token> — developer history\n` +
    `/holders <token> — holder breakdown\n` +
    `/watch <token> — alert on cluster selling\n` +
    `/new · /trending — Radar feed\n` +
    `/ask <question> — evidence-backed answers\n` +
    `/settings — group configuration\n\n` +
    `Vane explains what is happening, shows evidence, and monitors what matters.`
  );
}
