"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiGet, apiGetSlow, apiPost } from "@/lib/api";

interface TxInspection {
  hash: string;
  status: string;
  blockNumber: string | null;
  from: string | null;
  to: string | null;
  valueEth: string | null;
  gasUsed: string | null;
  gas?: {
    gasUsed: string | null;
    effectiveGasPrice: string | null;
    gasCostEth: string | null;
    callDataBytes: number | null;
  };
  functionName: string | null;
  inputSelector: string | null;
  revertReason: string | null;
  summary: string;
  assetMovements: { from: string; to: string; valueEth: string; token?: string }[];
  logs: {
    address: string;
    eventHint?: string;
    topics: string[];
    decoded?: { eventName: string; args: Record<string, unknown> };
  }[];
  trace: { type: string; from: string; to?: string; error?: string; calls?: unknown[] } | null;
  traceNote: string | null;
  relatedCode: { path: string; line: number; functionName: string; selector: string }[];
  addressRoles: { address: string; role?: string; label?: string; kind: string }[];
  risks: { severity: string; text: string }[];
  nextSteps: string[];
}

type Panel = "summary" | "assets" | "trace" | "logs" | "revert" | "risks";

function TxInspectorInner() {
  const searchParams = useSearchParams();
  const [hash, setHash] = useState("");
  const [projectId, setProjectId] = useState("");
  const [panel, setPanel] = useState<Panel>("summary");
  const [inspection, setInspection] = useState<TxInspection | null>(null);
  const [repair, setRepair] = useState<{
    proposedPatch: string;
    testSketch: string;
    simulationGate: string;
    simulation?: { provider: string; before: { status: string; note: string } };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = searchParams.get("hash");
    const pid = searchParams.get("projectId");
    if (q) setHash(q);
    if (pid) setProjectId(pid);
  }, [searchParams]);

  useEffect(() => {
    if (!projectId) {
      void apiGet<{ items: { id: string }[] }>("/v1/debug/projects")
        .then((d) => {
          if (d.items[0]) setProjectId(d.items[0].id);
        })
        .catch(() => undefined);
    }
  }, [projectId]);

  async function inspectOnly() {
    setBusy(true);
    setError(null);
    setRepair(null);
    try {
      const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
      const data = await apiGetSlow<TxInspection>(`/v1/debug/tx/${hash.trim()}${qs}`);
      setInspection(data);
      setPanel(data.status === "reverted" ? "revert" : "summary");
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
        repair: NonNullable<typeof repair>;
      }>(`/v1/debug/tx/${hash.trim()}/debug`, { projectId: projectId || undefined });
      setInspection(data.inspection);
      setRepair(data.repair);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Debug failed");
    } finally {
      setBusy(false);
    }
  }

  const panels: { id: Panel; label: string }[] = [
    { id: "summary", label: "Summary" },
    { id: "assets", label: "Assets" },
    { id: "trace", label: "Trace" },
    { id: "logs", label: "Logs" },
    { id: "revert", label: "Revert" },
    { id: "risks", label: "Risks" },
  ];

  return (
    <div className="px-4 py-8 md:px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-accent)]">
        Screen 3 · Inspector
      </p>
      <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
        Transaction inspector
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-muted)]">
        Receipt, ABI-decoded logs, gas, call-tree when the node/Tenderly supports it, and memory
        roles. Traces are never invented.
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
          placeholder="project id"
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
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {panels.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPanel(p.id)}
                className={`rounded-full px-3 py-1 text-xs ${
                  panel === p.id
                    ? "bg-[var(--color-accent-dim)] text-[var(--color-accent)]"
                    : "border border-[var(--color-line)] text-[var(--color-muted)]"
                }`}
              >
                {p.label}
              </button>
            ))}
            <Link
              href={`/debug/repair?hash=${inspection.hash}&projectId=${projectId}`}
              className="ml-auto rounded-full bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-[#04140d]"
            >
              Open in Repair
            </Link>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <section className="space-y-4">
              {panel === "summary" && (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs uppercase ${
                        inspection.status === "reverted"
                          ? "bg-[rgba(255,92,92,0.15)] text-[var(--color-danger)]"
                          : "bg-[rgba(61,255,168,0.12)] text-[var(--color-accent)]"
                      }`}
                    >
                      {inspection.status}
                    </span>
                    {inspection.functionName && (
                      <span className="font-mono text-xs text-[var(--color-accent)]">
                        {inspection.functionName} ({inspection.inputSelector})
                      </span>
                    )}
                  </div>
                  <p className="leading-relaxed">{inspection.summary}</p>
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
                      <dt className="text-[var(--color-muted)]">Gas</dt>
                      <dd className="text-xs">
                        used {inspection.gas?.gasUsed ?? inspection.gasUsed ?? "—"} · cost{" "}
                        {inspection.gas?.gasCostEth ?? "—"} ETH · calldata{" "}
                        {inspection.gas?.callDataBytes ?? "—"} B
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--color-muted)]">Hash</dt>
                      <dd className="break-all font-mono text-xs">{inspection.hash}</dd>
                    </div>
                  </dl>
                  {inspection.relatedCode.length > 0 && (
                    <div>
                      <h3 className="font-semibold">Source map</h3>
                      <ul className="mt-2 space-y-1 font-mono text-xs">
                        {inspection.relatedCode.map((c) => (
                          <li key={c.selector}>
                            {c.path}:{c.line} · {c.functionName}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold">Memory roles</h3>
                    <ul className="mt-2 space-y-1 font-mono text-xs text-[var(--color-muted)]">
                      {inspection.addressRoles.map((r) => (
                        <li key={r.address}>
                          {r.address.slice(0, 12)}… · {r.kind}
                          {r.role ? `/${r.role}` : ""}
                          {r.label ? ` (${r.label})` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              {panel === "assets" && (
                <ul className="space-y-2 text-xs font-mono">
                  {inspection.assetMovements.length === 0 && (
                    <li className="text-[var(--color-muted)]">None detected</li>
                  )}
                  {inspection.assetMovements.map((m, i) => (
                    <li key={i} className="rounded border border-[var(--color-line)] px-3 py-2">
                      {m.from.slice(0, 10)}… → {m.to.slice(0, 10)}…
                      {m.token ? ` · token ${m.token.slice(0, 10)}…` : ` · ${m.valueEth} ETH`}
                    </li>
                  ))}
                </ul>
              )}

              {panel === "trace" && (
                <div>
                  {inspection.traceNote && (
                    <p className="mb-3 text-sm text-[var(--color-warn)]">{inspection.traceNote}</p>
                  )}
                  {inspection.trace ? (
                    <pre className="max-h-96 overflow-auto rounded bg-black/40 p-3 text-[11px]">
                      {JSON.stringify(inspection.trace, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-sm text-[var(--color-muted)]">No call-tree available.</p>
                  )}
                </div>
              )}

              {panel === "logs" && (
                <ul className="max-h-96 space-y-2 overflow-y-auto text-xs font-mono">
                  {inspection.logs.map((l, i) => (
                    <li key={i} className="rounded border border-[var(--color-line)] px-3 py-2">
                      <div>
                        {l.decoded?.eventName ?? l.eventHint ?? "event"} @ {l.address.slice(0, 12)}…
                      </div>
                      {l.decoded && (
                        <div className="mt-1 text-[var(--color-muted)]">
                          {JSON.stringify(l.decoded.args)}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {panel === "revert" && (
                <p className="rounded-lg border border-[var(--color-danger)]/30 bg-[rgba(255,92,92,0.08)] px-3 py-2 font-mono text-sm text-[var(--color-danger)]">
                  {inspection.revertReason ?? "No revert reason decoded"}
                </p>
              )}

              {panel === "risks" && (
                <ul className="space-y-2 text-sm">
                  {inspection.risks.length === 0 && (
                    <li className="text-[var(--color-muted)]">No automatic risk flags</li>
                  )}
                  {inspection.risks.map((r, i) => (
                    <li key={i} className="text-[var(--color-warn)]">
                      [{r.severity}] {r.text}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <aside className="space-y-4">
              <div className="rounded-xl border border-[var(--color-line)] p-4">
                <h3 className="font-semibold">Next steps</h3>
                <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-[var(--color-muted)]">
                  {inspection.nextSteps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
              {repair && (
                <div className="rounded-xl border border-[var(--color-accent)]/30 bg-[rgba(61,255,168,0.05)] p-4">
                  <h3 className="font-semibold">Proposed repair</h3>
                  {repair.simulation && (
                    <p className="mt-2 text-xs text-[var(--color-muted)]">
                      Sim ({repair.simulation.provider}): {repair.simulation.before.status} —{" "}
                      {repair.simulation.before.note}
                    </p>
                  )}
                  <pre className="mt-3 max-h-48 overflow-auto rounded bg-black/40 p-3 text-[11px]">
                    {repair.proposedPatch}
                  </pre>
                  <p className="mt-2 text-xs text-[var(--color-muted)]">{repair.simulationGate}</p>
                </div>
              )}
            </aside>
          </div>
        </>
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
