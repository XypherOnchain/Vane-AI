"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiGetSlow, apiPost } from "@/lib/api";

interface TxInspection {
  hash: string;
  status: string;
  blockNumber: string | null;
  from: string | null;
  to: string | null;
  valueEth: string | null;
  gasUsed: string | null;
  revertReason: string | null;
  summary: string;
  assetMovements: { from: string; to: string; valueEth: string; token?: string }[];
  logs: { address: string; eventHint?: string; topics: string[] }[];
  risks: { severity: string; text: string }[];
  nextSteps: string[];
}

function TxInspectorInner() {
  const searchParams = useSearchParams();
  const [hash, setHash] = useState("");
  const [projectId, setProjectId] = useState("");
  const [inspection, setInspection] = useState<TxInspection | null>(null);
  const [repair, setRepair] = useState<{
    proposedPatch: string;
    testSketch: string;
    simulationGate: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = searchParams.get("hash");
    if (q) setHash(q);
  }, [searchParams]);

  async function inspectOnly() {
    setBusy(true);
    setError(null);
    setRepair(null);
    try {
      const data = await apiGetSlow<TxInspection>(`/v1/debug/tx/${hash.trim()}`);
      setInspection(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Inspect failed");
      setInspection(null);
    } finally {
      setBusy(false);
    }
  }

  async function fullDebug() {
    setBusy(true);
    setError(null);
    try {
      const data = await apiPost<{
        inspection: TxInspection;
        repair: {
          proposedPatch: string;
          testSketch: string;
          simulationGate: string;
        };
      }>(`/v1/debug/tx/${hash.trim()}/debug`, { projectId: projectId || undefined });
      setInspection(data.inspection);
      setRepair(data.repair);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Debug failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-8 md:px-8">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
        Transaction inspector
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-muted)]">
        Paste a Robinhood Chain transaction hash. Vane reads the receipt from RPC — no invented
        traces. Source mapping and fork simulation expand next.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <input
          value={hash}
          onChange={(e) => setHash(e.target.value)}
          placeholder="0x… transaction hash"
          className="min-w-[320px] flex-1 rounded-lg border border-[var(--color-line)] bg-black/30 px-3 py-2.5 font-mono text-xs"
        />
        <input
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          placeholder="project id (optional — saves incident)"
          className="w-[220px] rounded-lg border border-[var(--color-line)] bg-black/30 px-3 py-2.5 font-mono text-xs"
        />
        <button
          type="button"
          disabled={busy || !hash.trim()}
          onClick={() => void inspectOnly()}
          className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm disabled:opacity-50"
        >
          Inspect
        </button>
        <button
          type="button"
          disabled={busy || !hash.trim()}
          onClick={() => void fullDebug()}
          className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#04140d] disabled:opacity-50"
        >
          Inspect + repair
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}

      {inspection && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded px-2 py-0.5 text-xs uppercase ${
                  inspection.status === "reverted"
                    ? "bg-[rgba(255,92,92,0.15)] text-[var(--color-danger)]"
                    : inspection.status === "success"
                      ? "bg-[rgba(61,255,168,0.12)] text-[var(--color-accent)]"
                      : "bg-white/5 text-[var(--color-muted)]"
                }`}
              >
                {inspection.status}
              </span>
              <span className="font-mono text-xs text-[var(--color-muted)]">
                block {inspection.blockNumber ?? "—"} · gas {inspection.gasUsed ?? "—"}
              </span>
            </div>
            <p className="leading-relaxed">{inspection.summary}</p>
            {inspection.revertReason && (
              <p className="rounded-lg border border-[var(--color-danger)]/30 bg-[rgba(255,92,92,0.08)] px-3 py-2 font-mono text-sm text-[var(--color-danger)]">
                {inspection.revertReason}
              </p>
            )}
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[var(--color-muted)]">From</dt>
                <dd className="font-mono text-xs">{inspection.from ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted)]">To</dt>
                <dd className="font-mono text-xs">{inspection.to ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted)]">Value</dt>
                <dd>{inspection.valueEth ? `${inspection.valueEth} ETH` : "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted)]">Hash</dt>
                <dd className="break-all font-mono text-xs">{inspection.hash}</dd>
              </div>
            </dl>

            <h3 className="pt-2 font-semibold">Asset movements</h3>
            <ul className="space-y-2 text-xs font-mono">
              {inspection.assetMovements.length === 0 && (
                <li className="text-[var(--color-muted)]">None detected from value / Transfer logs</li>
              )}
              {inspection.assetMovements.map((m, i) => (
                <li key={i} className="rounded border border-[var(--color-line)] px-3 py-2">
                  {m.from.slice(0, 10)}… → {m.to.slice(0, 10)}…
                  {m.token ? ` · token ${m.token.slice(0, 10)}…` : ` · ${m.valueEth} ETH`}
                </li>
              ))}
            </ul>

            <h3 className="pt-2 font-semibold">Logs ({inspection.logs.length})</h3>
            <ul className="max-h-64 space-y-1 overflow-y-auto text-xs font-mono">
              {inspection.logs.map((l, i) => (
                <li key={i} className="text-[var(--color-muted)]">
                  {l.eventHint ?? "event"} @ {l.address.slice(0, 12)}…
                </li>
              ))}
            </ul>
          </section>

          <aside className="space-y-4">
            <div className="rounded-xl border border-[var(--color-line)] p-4">
              <h3 className="font-semibold">Risks</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {inspection.risks.length === 0 && (
                  <li className="text-[var(--color-muted)]">No automatic risk flags</li>
                )}
                {inspection.risks.map((r, i) => (
                  <li key={i} className="text-[var(--color-warn)]">
                    [{r.severity}] {r.text}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-[var(--color-line)] p-4">
              <h3 className="font-semibold">Next steps</h3>
              <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-[var(--color-muted)]">
                {inspection.nextSteps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              <Link
                href="/debug/repair"
                className="mt-4 inline-block text-sm text-[var(--color-accent)]"
              >
                Open Repair screen →
              </Link>
            </div>
            {repair && (
              <div className="rounded-xl border border-[var(--color-accent)]/30 bg-[rgba(61,255,168,0.05)] p-4">
                <h3 className="font-semibold">Proposed repair (simulation)</h3>
                <pre className="mt-3 max-h-48 overflow-auto rounded bg-black/40 p-3 text-[11px] leading-relaxed">
                  {repair.proposedPatch}
                </pre>
                <p className="mt-2 text-xs text-[var(--color-muted)]">{repair.simulationGate}</p>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

export default function TxInspectorPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[var(--color-muted)]">Loading inspector…</div>}>
      <TxInspectorInner />
    </Suspense>
  );
}
