import Link from "next/link";
import { formatAge, formatPct, formatUsd, shortAddress, type TokenOverview } from "@vane/shared-types";
import { apiGet } from "@/lib/api";
import { TokenAsk } from "@/components/TokenAsk";

export const dynamic = "force-dynamic";

const tabs = ["overview", "holders", "graph", "contract", "developer", "alerts"] as const;

export default async function TokenPage({
  params,
  searchParams,
}: {
  params: Promise<{ address: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { address } = await params;
  const { tab = "overview" } = await searchParams;
  let token: TokenOverview | null = null;
  try {
    token = await apiGet<TokenOverview>(`/v1/tokens/${address}`);
  } catch {
    token = null;
  }

  if (!token) {
    return (
      <div className="px-4 py-12 md:px-8">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">
          Not indexed yet
        </h1>
        <p className="mt-2 text-[var(--color-muted)]">
          Vane has no verified chain data for {address}. It never substitutes simulated findings —
          this page will populate once indexing covers the token.
        </p>
        <Link href="/radar" className="mt-4 inline-block text-[var(--color-accent)]">
          Back to Radar
        </Link>
      </div>
    );
  }

  const active = tabs.includes(tab as (typeof tabs)[number]) ? tab : "overview";

  return (
    <div className="px-4 py-6 pb-28 md:px-8">
      {token.warnings[0] && (
        <Link
          href={token.warnings[0].href}
          className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[rgba(255,176,32,0.35)] bg-[rgba(255,176,32,0.08)] px-4 py-3 text-sm text-[var(--color-warn)]"
        >
          <span>{token.warnings[0].text}</span>
          <span className="shrink-0 text-xs">Evidence →</span>
        </Link>
      )}

      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          {token.dataSource === "demo" && (
            <p className="mb-2 inline-block rounded border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-warn)]">
              Demonstration data — not live
            </p>
          )}
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-muted)]">
            Vane Scan · {token.launchpad ?? "Robinhood"} · {token.processingState}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight">
            ${token.symbol}
          </h1>
          <p className="text-[var(--color-muted)]">{token.name}</p>
          <p className="mt-2 font-mono text-xs">{token.address}</p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <div className="text-[11px] text-[var(--color-muted)]">Integrity</div>
            <div className="font-[family-name:var(--font-display)] text-3xl font-extrabold text-[var(--color-accent)]">
              {token.integrity.total}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[var(--color-muted)]">Momentum</div>
            <div className="font-[family-name:var(--font-display)] text-3xl font-extrabold">
              {token.momentum.total}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[var(--color-muted)]">Data</div>
            <div className="font-[family-name:var(--font-display)] text-xl font-bold capitalize">
              {token.dataConfidence.level}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
        {[
          ["Price", token.priceUsd > 0 ? formatUsd(token.priceUsd, 8) : "—"],
          ["Mcap", token.marketCapUsd > 0 ? formatUsd(token.marketCapUsd) : "—"],
          ["Liquidity", token.liquidityUsd > 0 ? formatUsd(token.liquidityUsd) : "—"],
          ["Vol 24h", token.volume24hUsd > 0 ? formatUsd(token.volume24hUsd) : "—"],
          ["Buys/Sells", token.buys1h + token.sells1h > 0 ? `${token.buys1h}/${token.sells1h}` : "—"],
          ["Holders", token.holders > 0 ? String(token.holders) : "—"],
          ["Age", formatAge(token.ageMinutes)],
          ["Connected", formatPct(token.probableConnectedSupplyPct)],
        ].map(([k, v]) => (
          <div key={k} className="border-t border-[var(--color-line)] pt-3">
            <div className="text-[11px] text-[var(--color-muted)]">{k}</div>
            <div className="tabular font-[family-name:var(--font-display)] text-lg font-bold">
              {v}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex gap-1 overflow-x-auto border-b border-[var(--color-line)]">
        {tabs.map((t) => (
          <Link
            key={t}
            href={`/token/${token.address}?tab=${t}`}
            className={`shrink-0 px-4 py-3 text-sm capitalize ${
              active === t
                ? "border-b-2 border-[var(--color-accent)] text-[var(--color-fg)]"
                : "text-[var(--color-muted)]"
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      {active === "overview" && (
        <div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
              Vane summary
            </h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-[var(--color-fg)]">{token.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--color-muted)]">
              {token.summaryEvidenceIds.map((id) => (
                <span
                  key={id}
                  className="rounded border border-[var(--color-line)] px-2 py-1 font-mono"
                >
                  {id}
                </span>
              ))}
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ["Confirmed connected", formatPct(token.confirmedConnectedSupplyPct)],
                ["Probable connected", formatPct(token.probableConnectedSupplyPct)],
                ["Fresh wallets", formatPct(token.freshWalletPct)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-[var(--color-line)] p-4">
                  <div className="text-xs text-[var(--color-muted)]">{k}</div>
                  <div className="mt-1 text-xl font-bold">{v}</div>
                </div>
              ))}
            </div>
            <TokenAsk tokenAddress={token.address} />
          </section>
          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
              Integrity breakdown
            </h2>
            <div className="mt-4 space-y-3">
              {(
                [
                  ["Contract safety", token.integrity.contractSafety, 25],
                  ["Distribution", token.integrity.distributionQuality, 25],
                  ["Liquidity", token.integrity.liquidityQuality, 20],
                  ["Developer", token.integrity.developerHistory, 15],
                  ["Market", token.integrity.marketIntegrity, 15],
                ] as const
              ).map(([label, value, max]) => (
                <div key={label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{label}</span>
                    <span className="font-mono text-[var(--color-muted)]">
                      {value}/{max}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full bg-[var(--color-accent)]"
                      style={{ width: `${(value / max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-[var(--color-muted)]">
              Momentum is separate and never implies safety. Score version {token.integrity.version}
              .
            </p>
          </section>
        </div>
      )}

      {active === "holders" && (
        <section className="mt-6">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">Top holders</h2>
          {token.topHolders.length === 0 && (
            <p className="mt-3 text-sm text-[var(--color-muted)]">
              Holder data unavailable right now — the explorer has not indexed this token yet.
            </p>
          )}
          <div className="mt-4 divide-y divide-[var(--color-line)]">
            {token.topHolders.map((h, i) => (
              <div key={h.address} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="w-6 text-[var(--color-muted)]">{i + 1}</span>
                  <Link href={`/wallet/${h.address}`} className="font-mono">
                    {shortAddress(h.address, 5)}
                  </Link>
                  {h.label && <span className="text-xs text-[var(--color-muted)]">{h.label}</span>}
                  {h.clusterId && <span className="text-xs text-[var(--color-warn)]">cluster</span>}
                </div>
                <span className="tabular">{formatPct(h.pctSupply)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {active === "graph" && (
        <section className="mt-6">
          <p className="text-sm text-[var(--color-muted)]">
            Full interactive graph with edge evidence.
          </p>
          <Link
            href={`/graph/${token.address}`}
            className="mt-4 inline-flex rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-[#04140d]"
          >
            Open bubble map
          </Link>
          {token.cluster && (
            <p className="mt-4 text-sm text-[var(--color-warn)]">
              Cluster {Math.round(token.cluster.confidence * 100)}% · {token.cluster.walletCount}{" "}
              wallets · probable {formatPct(token.cluster.probableSupplyPct)}
            </p>
          )}
        </section>
      )}

      {active === "contract" && (
        <section className="mt-6 space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">Findings</h2>
          {token.findings.map((f) => (
            <div key={f.id} className="rounded-xl border border-[var(--color-line)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-[11px] uppercase ${
                    f.severity === "high" || f.severity === "critical"
                      ? "bg-[rgba(255,92,92,0.15)] text-[var(--color-danger)]"
                      : f.severity === "medium"
                        ? "bg-[rgba(255,176,32,0.15)] text-[var(--color-warn)]"
                        : "bg-white/5 text-[var(--color-muted)]"
                  }`}
                >
                  {f.severity}
                </span>
                <span className="text-xs text-[var(--color-muted)]">{f.status}</span>
              </div>
              <h3 className="mt-2 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{f.summary}</p>
              <p className="mt-2 font-mono text-xs text-[var(--color-muted)]">
                {f.technicalDetails}
              </p>
            </div>
          ))}
        </section>
      )}

      {active === "developer" && (
        <section className="mt-6">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">Developer</h2>
          <p className="mt-3 font-mono text-sm">
            <Link href={`/wallet/${token.deployer}`}>{shortAddress(token.deployer, 6)}</Link>
          </p>
          {token.deployerFunding && (
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Funded by{" "}
              <Link
                href={`/wallet/${token.deployerFunding}`}
                className="font-mono text-[var(--color-fg)]"
              >
                {shortAddress(token.deployerFunding, 6)}
              </Link>
            </p>
          )}
          <p className="mt-4 text-sm text-[var(--color-muted)]">
            Prior-launch outcomes and network mapping expand as the indexer backfills deployer
            history.
          </p>
        </section>
      )}

      {active === "alerts" && (
        <section className="mt-6">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">Alerts</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Create cluster-sale, deployer-sale, liquidity, and score alerts from the authenticated
            app. Delivery: website notifications and Intelligence Bot DM.
          </p>
          <Link
            href="/app/alerts"
            className="mt-4 inline-flex rounded-full border border-[var(--color-line)] px-4 py-2 text-sm"
          >
            Open alerts
          </Link>
        </section>
      )}
    </div>
  );
}
