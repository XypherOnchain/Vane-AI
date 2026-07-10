import Link from "next/link";
import { formatPct, formatUsd, type RadarCard } from "@vane/shared-types";
import { apiGet } from "@/lib/api";

export const dynamic = "force-dynamic";

async function loadRadar(mode: "radar" | "new-pairs" | "trending"): Promise<RadarCard[]> {
  const path = mode === "radar" ? "/v1/radar" : mode === "new-pairs" ? "/v1/new-pairs" : "/v1/trending";
  try {
    const data = await apiGet<{ items: RadarCard[] }>(path);
    return data.items;
  } catch {
    return [];
  }
}

export default async function RadarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mode?: string }>;
}) {
  const sp = await searchParams;
  const mode = (sp.mode as "radar" | "new-pairs" | "trending") || "radar";
  let items = await loadRadar(mode === "new-pairs" || mode === "trending" ? mode : "radar");
  if (sp.q) {
    const lower = sp.q.toLowerCase();
    items = items.filter(
      (i) =>
        i.symbol.toLowerCase().includes(lower) ||
        i.name.toLowerCase().includes(lower) ||
        i.address.includes(lower),
    );
  }

  return (
    <div className="px-4 py-8 pb-24 md:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
            Radar
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--color-muted)]">
            Live Robinhood Chain discovery — same intelligence the New Pairs bot will publish.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {[
            ["radar", "All"],
            ["new-pairs", "New"],
            ["trending", "Trending"],
          ].map(([m, label]) => (
            <Link
              key={m}
              href={m === "radar" ? "/radar" : `/${m}`}
              className={`rounded-full border px-3 py-1.5 ${
                (mode === "radar" && m === "radar") || mode === m
                  ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                  : "border-[var(--color-line)] text-[var(--color-muted)]"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-line)]">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-[var(--color-line)] bg-white/[0.02] text-xs uppercase tracking-wide text-[var(--color-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Token</th>
              <th className="px-3 py-3 font-medium">Age</th>
              <th className="px-3 py-3 font-medium">Mcap</th>
              <th className="px-3 py-3 font-medium">Liq</th>
              <th className="px-3 py-3 font-medium">Vol 1h</th>
              <th className="px-3 py-3 font-medium">Holders</th>
              <th className="px-3 py-3 font-medium">Connected</th>
              <th className="px-3 py-3 font-medium">Integrity</th>
              <th className="px-3 py-3 font-medium">Momentum</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.address} className="border-b border-[var(--color-line)] hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <Link href={`/token/${t.address}`} className="font-semibold">
                    ${t.symbol}
                  </Link>
                  <div className="font-mono text-[11px] text-[var(--color-muted)]">
                    {t.address.slice(0, 8)}…{t.address.slice(-4)}
                  </div>
                  {t.alerts[0] && (
                    <div className="mt-1 text-[11px] text-[var(--color-warn)]">{t.alerts[0]}</div>
                  )}
                </td>
                <td className="tabular px-3 py-3">{t.ageMinutes}m</td>
                <td className="tabular px-3 py-3">{formatUsd(t.marketCapUsd)}</td>
                <td className="tabular px-3 py-3">{formatUsd(t.liquidityUsd)}</td>
                <td className="tabular px-3 py-3">{formatUsd(t.volume1hUsd)}</td>
                <td className="tabular px-3 py-3">{t.holders}</td>
                <td
                  className={`tabular px-3 py-3 ${
                    t.connectedSupplyPct > 20 ? "text-[var(--color-danger)]" : ""
                  }`}
                >
                  {formatPct(t.connectedSupplyPct)}
                </td>
                <td className="tabular px-3 py-3 text-[var(--color-accent)]">{t.integrityScore}</td>
                <td className="tabular px-3 py-3">{t.momentumScore}</td>
                <td className="px-3 py-3 text-[var(--color-muted)]">
                  {t.status}
                  {!t.dataReady.graph && (
                    <div className="text-[10px] text-[var(--color-warn)]">Graph indexing</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Link href={`/token/${t.address}`} className="text-[var(--color-accent)]">
                      Open
                    </Link>
                    <Link href={`/graph/${t.address}`} className="text-[var(--color-muted)]">
                      Graph
                    </Link>
                    <Link
                      href={`/ask?q=${encodeURIComponent(`What is the biggest risk on ${t.address}?`)}`}
                      className="text-[var(--color-muted)]"
                    >
                      Ask
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <p className="p-6 text-sm text-[var(--color-muted)]">
            No tokens yet. Start the API (`pnpm --filter @vane/api dev`).
          </p>
        )}
      </div>
    </div>
  );
}
