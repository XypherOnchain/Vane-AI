"use client";

import { useState } from "react";
import { apiGet } from "@/lib/api";

export default function AgentPage() {
  const [kind, setKind] = useState("gas_topup");
  const [value, setValue] = useState("0.01");
  const [human, setHuman] = useState(false);
  const [result, setResult] = useState<string>("");
  const [jobs, setJobs] = useState<string>("");

  async function submit() {
    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    const res = await fetch(`${API}/v1/agent-jobs/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        nativeValueEth: Number(value),
        humanApproved: human,
      }),
    });
    const body = await res.json();
    setResult(JSON.stringify(body, null, 2));
    const list = await apiGet("/v1/agent-jobs/jobs");
    setJobs(JSON.stringify(list, null, 2));
  }

  return (
    <div className="px-4 py-8 md:px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-accent)]">
        Phase 5 · Agent
      </p>
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold">
        Policy-constrained jobs
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">
        Claims, gas top-up, limited rebalance — only within policy. High-value irreversible actions
        require a human.
      </p>
      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Kind
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="mt-1 block rounded-lg border border-[var(--color-line)] bg-black/30 px-2 py-2"
          >
            <option value="gas_topup">gas_topup</option>
            <option value="claim">claim</option>
            <option value="rebalance">rebalance</option>
            <option value="incident_triage">incident_triage</option>
          </select>
        </label>
        <label className="text-sm">
          Native ETH
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1 block w-28 rounded-lg border border-[var(--color-line)] bg-black/30 px-2 py-2 font-mono text-xs"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={human} onChange={(e) => setHuman(e.target.checked)} />
          Human approved
        </label>
        <button
          type="button"
          onClick={() => void submit()}
          className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#04140d]"
        >
          Submit job
        </button>
      </div>
      {result && (
        <pre className="mt-6 max-w-2xl overflow-auto rounded-lg bg-black/40 p-3 text-xs">{result}</pre>
      )}
      {jobs && (
        <pre className="mt-4 max-w-3xl overflow-auto rounded-lg bg-black/40 p-3 text-xs">{jobs}</pre>
      )}
    </div>
  );
}
