import Link from "next/link";
import { formatUsd, type TokenScan } from "@vane/shared";
import { apiGet } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let report: {
    id: string;
    tokenAddress: string;
    summary: string;
    payload: TokenScan;
  } | null = null;
  try {
    report = await apiGet(`/v1/reports/${id}`);
  } catch {
    report = null;
  }

  if (!report) {
    return (
      <div className="container" style={{ padding: "3rem 0" }}>
        <h1>Report not found</h1>
      </div>
    );
  }

  const t = report.payload;
  return (
    <div className="container" style={{ padding: "2.5rem 0 4rem" }}>
      <p className="mono muted">SHAREABLE INVESTIGATION · {report.id}</p>
      <h1 style={{ fontFamily: "var(--font-display)" }}>
        ${t.symbol} · Score {t.vaneScore.total}
      </h1>
      <p style={{ maxWidth: 720, lineHeight: 1.6 }}>{report.summary}</p>
      <div className="grid-metrics" style={{ marginTop: "1.5rem" }}>
        {[
          ["FDV", formatUsd(t.fdvUsd)],
          ["Liquidity", formatUsd(t.liquidityUsd)],
          ["Connected", `${t.connectedSupplyPct}%`],
          ["Holders", String(t.holders)],
        ].map(([k, v]) => (
          <div key={k} className="panel">
            <div className="muted" style={{ fontSize: "0.75rem" }}>
              {k}
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: "1.5rem" }}>
        <Link href={`/token/${t.address}`} className="btn btn-primary">
          Open full scan
        </Link>
        <Link href={`/graph/${t.address}`} className="btn">
          Open graph
        </Link>
      </div>
    </div>
  );
}
