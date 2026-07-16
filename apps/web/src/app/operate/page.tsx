"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

export default function OperatePage() {
  const [projectId, setProjectId] = useState("");
  const [dash, setDash] = useState<Record<string, unknown> | null>(null);
  const [policy, setPolicy] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void apiGet<{ items: { id: string }[] }>("/v1/debug/projects").then((d) => {
      if (d.items[0]) setProjectId(d.items[0].id);
    });
    void apiGet<Record<string, unknown>>("/v1/operate/policy").then(setPolicy);
  }, []);

  async function load() {
    if (!projectId) return;
    setDash(await apiGet(`/v1/operate/dashboard/${projectId}`));
  }

  return (
    <div className="px-4 py-8 md:px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-accent)]">
        Phase 4 · Operate
      </p>
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold">
        Treasury & inventory
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">
        Multi-chain wallet roles, production contract monitoring, spending policies. Local encrypted
        vault stays on desktop only.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <input
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="min-w-[240px] rounded-lg border border-[var(--color-line)] bg-black/30 px-3 py-2 font-mono text-xs"
        />
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#04140d]"
        >
          Load dashboard
        </button>
      </div>
      {policy && (
        <pre className="mt-6 max-w-2xl overflow-auto rounded-lg bg-black/40 p-3 text-xs">
          {JSON.stringify(policy, null, 2)}
        </pre>
      )}
      {dash && (
        <pre className="mt-4 max-w-3xl overflow-auto rounded-lg bg-black/40 p-3 text-xs">
          {JSON.stringify(dash, null, 2)}
        </pre>
      )}
    </div>
  );
}
