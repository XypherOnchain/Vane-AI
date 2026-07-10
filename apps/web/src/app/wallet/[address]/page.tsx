import Link from "next/link";
import { formatUsd, type WalletDna } from "@vane/shared";
import { apiGet } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function WalletPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  let wallet: WalletDna | null = null;
  try {
    wallet = await apiGet(`/v1/wallets/${address}`);
  } catch {
    wallet = null;
  }

  if (!wallet) {
    return (
      <div className="container" style={{ padding: "3rem 0" }}>
        <h1>Wallet not found</h1>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: "2rem 0 4rem" }}>
      <p className="mono muted" style={{ fontSize: "0.78rem" }}>
        WALLET DNA
      </p>
      <h1 style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>
        {wallet.dnaClass}
      </h1>
      <p className="mono muted">{wallet.address}</p>

      <div className="grid-metrics" style={{ marginTop: "2rem" }}>
        {[
          ["Win rate", `${Math.round(wallet.winRate * 100)}%`],
          ["Realized PnL", formatUsd(wallet.realizedPnlUsd)],
          ["Median entry", `${wallet.medianEntryMinutes}m`],
          ["Median hold", `${wallet.medianHoldMinutes}m`],
          ["Median size", `${wallet.medianPositionEth} ETH`],
          ["Completed", `${wallet.completedWins}/${wallet.completedTotal}`],
          ["Wallet age", `${wallet.walletAgeDays}d`],
          ["Cluster size", String(wallet.associatedClusterSize)],
        ].map(([k, v]) => (
          <div key={k} className="panel">
            <div className="muted" style={{ fontSize: "0.75rem" }}>
              {k}
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>{v}</div>
          </div>
        ))}
      </div>

      <p style={{ marginTop: "1.5rem", maxWidth: 640 }}>{wallet.recentBehaviorNote}</p>
      <div style={{ marginTop: "1.5rem" }}>
        <Link href="/radar" className="btn">
          Back to Radar
        </Link>
      </div>
    </div>
  );
}
