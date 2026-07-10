import Link from "next/link";
import { formatPct, formatUsd, type RadarCard } from "@vane/shared";
import { apiGet } from "@/lib/api";
import { SearchBox } from "@/components/SearchBox";

export const dynamic = "force-dynamic";

export default async function RadarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  let items: RadarCard[] = [];
  try {
    const data = await apiGet<{ items: RadarCard[] }>("/v1/radar");
    items = data.items;
  } catch {
    items = [];
  }
  if (q) {
    const lower = q.toLowerCase();
    items = items.filter(
      (i) =>
        i.symbol.toLowerCase().includes(lower) ||
        i.name.toLowerCase().includes(lower) ||
        i.address.includes(lower),
    );
  }

  return (
    <div className="container" style={{ padding: "2.5rem 0 4rem" }}>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(2rem, 4vw, 3rem)",
          letterSpacing: "-0.03em",
          margin: "0 0 0.5rem",
        }}
      >
        Radar
      </h1>
      <p className="muted" style={{ marginBottom: "1.5rem", maxWidth: 560 }}>
        Live discovery feed for Robinhood Chain launches, liquidity, and cluster risk.
      </p>
      <div style={{ maxWidth: 640, marginBottom: "2rem" }}>
        <SearchBox placeholder="Filter by name, symbol, or paste address" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {items.map((t) => (
          <Link
            key={t.address}
            href={`/token/${t.address}`}
            className="panel"
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 1fr 1fr auto",
              gap: "1rem",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
                ${t.symbol}{" "}
                <span className="muted" style={{ fontWeight: 400, fontSize: "0.9rem" }}>
                  {t.name}
                </span>
              </div>
              <div className="mono muted" style={{ fontSize: "0.78rem", marginTop: 4 }}>
                {t.address.slice(0, 10)}…{t.address.slice(-6)}
              </div>
              {t.alerts.length > 0 && (
                <div style={{ marginTop: 8, display: "var(--warn)", fontSize: "0.82rem" }}>
                  {t.alerts.join(" · ")}
                </div>
              )}
            </div>
            <div>
              <div className="muted" style={{ fontSize: "0.75rem" }}>
                Mcap / Liq
              </div>
              <div>
                {formatUsd(t.marketCapUsd)} / {formatUsd(t.liquidityUsd)}
              </div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: "0.75rem" }}>
                Holders / Age
              </div>
              <div>
                {t.holders} / {t.ageMinutes}m
              </div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: "0.75rem" }}>
                Connected
              </div>
              <div style={{ color: t.connectedSupplyPct > 20 ? "var(--danger)" : "var(--fg)" }}>
                {formatPct(t.connectedSupplyPct)}
              </div>
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "1.25rem",
                color: t.vaneScore >= 60 ? "var(--accent)" : "var(--warn)",
              }}
            >
              {t.vaneScore}
            </div>
          </Link>
        ))}
        {items.length === 0 && (
          <p className="muted">No radar items yet. Start the API and indexer.</p>
        )}
      </div>
    </div>
  );
}
