"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiPost } from "@/lib/api";

function RepairInner() {
  const searchParams = useSearchParams();
  const [hash, setHash] = useState("");
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    inspection: { status: string; summary: string; functionName: string | null };
    repair: {
      proposedPatch: string;
      testSketch: string;
      simulationGate: string;
      simulation: {
        provider: string;
        before: { status: string; note: string };
        after: { status: string; note: string };
        assetDelta?: string;
        error?: string;
      };
    };
  } | null>(null);

  useEffect(() => {
    const h = searchParams.get("hash");
    const p = searchParams.get("projectId");
    if (h) setHash(h);
    if (p) setProjectId(p);
  }, [searchParams]);

  async function run() {
    if (!hash.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiPost<NonNullable<typeof result>>(`/v1/debug/tx/${hash.trim()}/repair`, {
        projectId: projectId || undefined,
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Repair failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-8 md:px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-accent)]">
        Screen 4 · Repair
      </p>
      <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">Repair loop</h2>
      <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">
        Generate patch + Forge test, run Tenderly or Anvil fork simulation (before/after). Live
        broadcast stays disabled.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <input
          value={hash}
          onChange={(e) => setHash(e.target.value)}
          placeholder="0x… failed tx"
          className="min-w-[280px] flex-1 rounded-lg border border-[var(--color-line)] bg-black/30 px-3 py-2 font-mono text-xs"
        />
        <input
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          placeholder="project id"
          className="w-[200px] rounded-lg border border-[var(--color-line)] bg-black/30 px-3 py-2 font-mono text-xs"
        />
        <button
          type="button"
          disabled={busy || !hash.trim()}
          onClick={() => void run()}
          className="rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[#04140d] disabled:opacity-50"
        >
          Propose + simulate
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="mt-6 flex flex-wrap gap-2 text-xs">
        <span className="rounded bg-[rgba(61,255,168,0.15)] px-2 py-1 text-[var(--color-accent)]">
          Simulation
        </span>
        <span className="rounded border border-[var(--color-line)] px-2 py-1 text-[var(--color-muted)]">
          Testnet
        </span>
        <span
          className="rounded border border-[var(--color-line)] px-2 py-1 text-[var(--color-muted)] opacity-40"
          title="Disabled in Phase 1"
        >
          Live (disabled)
        </span>
      </div>

      {result && (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section>
            <h3 className="font-semibold">Patch</h3>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{result.inspection.summary}</p>
            <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-black/40 p-3 text-[11px]">
              {result.repair.proposedPatch}
            </pre>
          </section>
          <section>
            <h3 className="font-semibold">Test + fork sim</h3>
            <div className="mt-2 rounded-lg border border-[var(--color-line)] p-3 text-sm">
              <p>
                Provider: <span className="font-mono">{result.repair.simulation.provider}</span>
              </p>
              <p className="mt-1">
                Before: {result.repair.simulation.before.status} —{" "}
                {result.repair.simulation.before.note}
              </p>
              <p className="mt-1">
                After: {result.repair.simulation.after.status} —{" "}
                {result.repair.simulation.after.note}
              </p>
              {result.repair.simulation.assetDelta && (
                <p className="mt-1 text-[var(--color-muted)]">
                  {result.repair.simulation.assetDelta}
                </p>
              )}
              {result.repair.simulation.error && (
                <p className="mt-2 text-[var(--color-warn)]">{result.repair.simulation.error}</p>
              )}
            </div>
            <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-black/40 p-3 text-[11px]">
              {result.repair.testSketch}
            </pre>
            <p className="mt-3 text-xs text-[var(--color-muted)]">{result.repair.simulationGate}</p>
          </section>
        </div>
      )}

      <Link href="/debug/tx" className="mt-8 inline-block text-sm text-[var(--color-accent)]">
        ← Back to inspector
      </Link>
    </div>
  );
}

export default function RepairPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[var(--color-muted)]">Loading repair…</div>}>
      <RepairInner />
    </Suspense>
  );
}
