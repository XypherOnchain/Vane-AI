import Link from "next/link";
import {
  formatPct,
  formatUsd,
  shortAddress,
  type TokenScan,
} from "@vane/shared";
import { apiGet, apiPost } from "@/lib/api";
import { AgentPanel } from "@/components/AgentPanel";
import { ScorePanel } from "@/components/ScorePanel";

export const dynamic = "force-dynamic";

export default async function TokenPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  let token: TokenScan | null = null;
  try {
    token = await apiGet<TokenScan>(`/v1/tokens/${address}`);
  } catch {
    token = null;
  }

  if (!token) {
    return (
      <div className="container" style={{ padding: "3rem 0" }}>
        <h1 style={{ fontFamily: "var(--font-display)" }}>Token not found</h1>
        <p className="muted">Indexing may still be running for {address}</p>
        <Link href="/radar" className="btn" style={{ marginTop: "1rem" }}>
          Back to Radar
        </Link>
      </div>
    );
  }

  let reportUrl: string | null = null;
  try {
    const report = await apiPost<{ url: string }>("/v1/reports", {
      tokenAddress: token.address,
    });
    reportUrl = report.url;
  } catch {
    reportUrl = null;
  }

  return (
    <div className="container" style={{ padding: "2rem 0 4rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div>
          <p className="mono muted" style={{ fontSize: "0.78rem", letterSpacing: "0.08em" }}>
            VANE SCAN · ROBINHOOD CHAIN
          </p>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2rem, 4vw, 3.2rem)",
              letterSpacing: "-0.03em",
              margin: "0.35rem 0",
            }}
          >
            ${token.symbol}
          </h1>
          <p className="muted">{token.name}</p>
          <p className="mono" style={{ marginTop: 8, fontSize: "0.85rem" }}>
            {token.address}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {token.securityTags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="muted" style={{ fontSize: "0.8rem" }}>
            Vane Score
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "3rem",
              fontWeight: 800,
              color: token.vaneScore.total >= 60 ? "var(--accent)" : "var(--warn)",
              lineHeight: 1,
            }}
          >
            {token.vaneScore.total}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
            <Link href={`/graph/${token.address}`} className="btn btn-primary">
              View graph
            </Link>
            {reportUrl && (
              <Link href={reportUrl.replace(/^https?:\/\/[^/]+/, "")} className="btn">
                Share report
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid-metrics" style={{ marginTop: "2rem" }}>
        {[
          ["Price", formatUsd(token.priceUsd, 8)],
          ["FDV", formatUsd(token.fdvUsd)],
          ["Liquidity", formatUsd(token.liquidityUsd)],
          ["Volume", formatUsd(token.volumeUsd)],
          ["Buys / Sells", `${token.buys1h} / ${token.sells1h}`],
          ["Holders", String(token.holders)],
          ["Age", `${token.ageMinutes}m`],
          ["Connected", formatPct(token.connectedSupplyPct)],
        ].map(([k, v]) => (
          <div key={k} className="panel">
            <div className="muted" style={{ fontSize: "0.75rem" }}>
              {k}
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.25rem" }}>
              {v}
            </div>
          </div>
        ))}
      </div>

      <section className="panel" style={{ marginTop: "1rem" }}>
        <h2 style={{ fontFamily: "var(--font-display)", margin: "0 0 0.75rem" }}>
          Intelligence summary
        </h2>
        <p style={{ lineHeight: 1.6, maxWidth: 820 }}>{token.summary}</p>
        {token.cluster && (
          <p style={{ marginTop: "1rem", color: "var(--warn)" }}>
            Probable cluster {Math.round(token.cluster.confidence * 100)}% confidence ·{" "}
            {token.cluster.walletCount} wallets · {formatPct(token.cluster.supplyPct)} supply
          </p>
        )}
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: "2rem",
          marginTop: "1rem",
        }}
        className="token-split"
      >
        <section className="panel">
          <h2 style={{ fontFamily: "var(--font-display)" }}>Top holders</h2>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {token.topHolders.map((h) => (
              <div
                key={h.address}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.65rem 0",
                  borderBottom: "1px solid var(--line)",
                  gap: "1rem",
                }}
              >
                <Link href={`/wallet/${h.address}`} className="mono" style={{ fontSize: "0.85rem" }}>
                  {shortAddress(h.address, 5)}
                  {h.isLp ? " · LP" : ""}
                  {h.clusterId ? " · cluster" : ""}
                </Link>
                <span>{formatPct(h.pctSupply)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2 style={{ fontFamily: "var(--font-display)" }}>Developer</h2>
          <p className="mono" style={{ fontSize: "0.85rem" }}>
            <Link href={`/wallet/${token.deployer}`}>{shortAddress(token.deployer, 6)}</Link>
          </p>
          {token.deployerFunding && (
            <p className="muted" style={{ marginTop: 8 }}>
              Funded by{" "}
              <Link href={`/wallet/${token.deployerFunding}`} className="mono">
                {shortAddress(token.deployerFunding, 6)}
              </Link>
            </p>
          )}
          <div style={{ marginTop: "1rem" }}>
            {token.previousLaunches.map((l) => (
              <div
                key={l.address}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.5rem 0",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <span>${l.symbol}</span>
                <span style={{ color: l.outcomePct < 0 ? "var(--danger)" : "var(--accent)" }}>
                  ATH {formatUsd(l.athFdvUsd)} → {l.outcomePct}%
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "1.25rem" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1rem" }}>Contract</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              <span className="tag">{token.contract.verified ? "Verified" : "Unverified"}</span>
              <span className="tag">
                {token.contract.ownershipRenounced ? "Renounced" : "Owned"}
              </span>
              <span className="tag">{token.contract.mintable ? "Mintable" : "No mint"}</span>
              <span className="tag">
                {token.contract.liquidityLocked ? "LP locked" : "LP unlocked"}
              </span>
            </div>
          </div>
        </section>
      </div>

      <ScorePanel score={token.vaneScore} />
      <AgentPanel tokenAddress={token.address} />

      <style>{`
        @media (max-width: 900px) {
          .token-split { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
