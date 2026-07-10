import Link from "next/link";
import { formatUsd, type WalletDna } from "@vane/shared-types";
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
      <div className="px-4 py-12 md:px-8">
        <h1 className="text-2xl font-bold">Wallet not found</h1>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 pb-24 md:px-8">
      <p className="font-mono text-[11px] text-[var(--color-muted)]">WALLET DNA</p>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">{wallet.dnaClass}</h1>
      <p className="mt-1 font-mono text-sm text-[var(--color-muted)]">{wallet.address}</p>
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          ["Win rate", `${Math.round(wallet.winRate * 100)}%`],
          ["Realized PnL", formatUsd(wallet.realizedPnlUsd)],
          ["Median entry", `${wallet.medianEntryMinutes}m`],
          ["Median hold", `${wallet.medianHoldMinutes}m`],
        ].map(([k, v]) => (
          <div key={k} className="border-t border-[var(--color-line)] pt-3">
            <div className="text-xs text-[var(--color-muted)]">{k}</div>
            <div className="font-[family-name:var(--font-display)] text-xl font-bold">{v}</div>
          </div>
        ))}
      </div>
      <p className="mt-6 max-w-xl text-sm">{wallet.recentBehaviorNote}</p>
      <p className="mt-2 text-xs text-[var(--color-muted)]">
        Realized and unrealized results are separated. Transfers are not automatically treated as trades.
      </p>
      <Link href="/radar" className="mt-6 inline-block text-[var(--color-accent)]">
        Back to Radar
      </Link>
    </div>
  );
}
