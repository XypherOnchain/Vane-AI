import Link from "next/link";
import { formatUsd, type TokenOverview } from "@vane/shared-types";
import { apiGet } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let report: {
    id: string;
    tokenAddress: string;
    summary: string;
    payload: TokenOverview;
  } | null = null;
  try {
    report = await apiGet(`/v1/reports/${id}`);
  } catch {
    report = null;
  }

  if (!report) {
    return (
      <div className="px-4 py-12 md:px-8">
        <h1 className="text-2xl font-bold">Report not found</h1>
      </div>
    );
  }

  const t = report.payload;
  return (
    <div className="px-4 py-8 pb-24 md:px-8">
      <p className="font-mono text-xs text-[var(--color-muted)]">SHAREABLE · {report.id}</p>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
        ${t.symbol} · Integrity {t.integrity.total}
      </h1>
      <p className="mt-4 max-w-2xl leading-relaxed">{report.summary}</p>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          ["FDV", formatUsd(t.fdvUsd)],
          ["Liquidity", formatUsd(t.liquidityUsd)],
          ["Connected", `${t.probableConnectedSupplyPct}%`],
          ["Holders", String(t.holders)],
        ].map(([k, v]) => (
          <div key={k} className="border-t border-[var(--color-line)] pt-3">
            <div className="text-xs text-[var(--color-muted)]">{k}</div>
            <div className="font-[family-name:var(--font-display)] text-xl font-bold">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex gap-3">
        <Link href={`/token/${t.address}`} className="text-[var(--color-accent)]">
          Full scan
        </Link>
        <Link href={`/graph/${t.address}`} className="text-[var(--color-muted)]">
          Graph
        </Link>
      </div>
    </div>
  );
}
