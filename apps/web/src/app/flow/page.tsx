"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiPost } from "@/lib/api";

function FlowInner() {
  const searchParams = useSearchParams();
  const [nl, setNl] = useState("Simulate bridge then policy-check before external sign");
  const [graph, setGraph] = useState<{
    id: string;
    nodes: { id: string; kind: string; label: string }[];
  } | null>(null);
  const [run, setRun] = useState<Record<string, unknown> | null>(null);
  const [approval, setApproval] = useState<Record<string, unknown> | null>(null);

  async function create() {
    const g = await apiPost<NonNullable<typeof graph>>("/v1/flow/workflows", { nl });
    setGraph(g);
    setRun(null);
  }

  async function start() {
    if (!graph) return;
    const r = await apiPost<Record<string, unknown>>(`/v1/flow/workflows/${graph.id}/run`, {});
    setRun(r);
    const card = await apiPost<Record<string, unknown>>("/v1/flow/approvals/telegram", {
      runId: r.id,
    });
    setApproval(card);
  }

  return (
    <div className="px-4 py-8 md:px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-accent)]">
        Phase 3 · Flow
      </p>
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold">Workflow builder</h2>
      <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">
        NL → IR (trigger → simulate → policy → sign → broadcast → confirm → audit). External signing
        only; Telegram approvals open desktop/wallet.
      </p>
      {searchParams.get("run") && (
        <p className="mt-2 text-xs text-[var(--color-accent)]">Deep link run: {searchParams.get("run")}</p>
      )}
      <textarea
        value={nl}
        onChange={(e) => setNl(e.target.value)}
        className="mt-6 min-h-[100px] w-full max-w-2xl rounded-lg border border-[var(--color-line)] bg-black/30 p-3 text-sm"
      />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void create()}
          className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#04140d]"
        >
          Build graph
        </button>
        <button
          type="button"
          disabled={!graph}
          onClick={() => void start()}
          className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm disabled:opacity-50"
        >
          Run (stops at sign)
        </button>
      </div>
      {graph && (
        <div className="mt-8 grid max-w-3xl gap-2">
          <p className="text-sm font-medium">Visual + code view</p>
          {graph.nodes.map((n, i) => (
            <div
              key={n.id}
              className="flex items-center gap-3 rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
            >
              <span className="font-mono text-[var(--color-accent)]">{i + 1}</span>
              <span className="font-mono text-xs text-[var(--color-muted)]">{n.kind}</span>
              <span>{n.label}</span>
            </div>
          ))}
          <pre className="mt-2 overflow-auto rounded bg-black/40 p-3 text-[11px]">
            {JSON.stringify(graph, null, 2)}
          </pre>
        </div>
      )}
      {run && (
        <pre className="mt-4 max-w-3xl overflow-auto rounded bg-black/40 p-3 text-xs">
          {JSON.stringify(run, null, 2)}
        </pre>
      )}
      {approval && (
        <pre className="mt-4 max-w-3xl overflow-auto rounded border border-[var(--color-warn)]/30 bg-[var(--color-warn)]/5 p-3 text-xs">
          {JSON.stringify(approval, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function FlowPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[var(--color-muted)]">Loading flow…</div>}>
      <FlowInner />
    </Suspense>
  );
}
