"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

interface Incident {
  id: string;
  projectId: string;
  txHash?: string;
  title: string;
  summary?: string;
  revertReason?: string;
  status: string;
  createdAt: string;
}

interface AuditEvent {
  id: string;
  kind: string;
  mode: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

export default function MemoryPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [audits, setAudits] = useState<AuditEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [i, a] = await Promise.all([
          apiGet<{ items: Incident[] }>("/v1/debug/incidents"),
          apiGet<{ items: AuditEvent[] }>("/v1/debug/audit?limit=30"),
        ]);
        setIncidents(i.items);
        setAudits(a.items);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load memory");
      }
    })();
  }, []);

  return (
    <div className="grid gap-8 px-4 py-8 md:grid-cols-2 md:px-8">
      <section>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">Incidents</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Every failure becomes reusable knowledge — root cause, tx, proposed fix.
        </p>
        {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}
        <ul className="mt-4 space-y-3">
          {incidents.length === 0 && (
            <li className="text-sm text-[var(--color-muted)]">
              No incidents yet. Use Inspect + repair with a project id.
            </li>
          )}
          {incidents.map((inc) => (
            <li key={inc.id} className="rounded-xl border border-[var(--color-line)] p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{inc.title}</span>
                <span className="text-[11px] uppercase text-[var(--color-muted)]">{inc.status}</span>
              </div>
              {inc.revertReason && (
                <p className="mt-2 font-mono text-xs text-[var(--color-danger)]">
                  {inc.revertReason}
                </p>
              )}
              {inc.txHash && (
                <p className="mt-2 break-all font-mono text-[11px] text-[var(--color-muted)]">
                  {inc.txHash}
                </p>
              )}
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                {new Date(inc.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">Audit log</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Structured record of every debug action. Mode is always visible.
        </p>
        <ul className="mt-4 max-h-[560px] space-y-2 overflow-y-auto text-sm">
          {audits.map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-3 border-b border-[var(--color-line)] py-2"
            >
              <div>
                <span className="font-mono text-xs">{a.kind}</span>
                <span className="ml-2 rounded border border-[var(--color-line)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--color-warn)]">
                  {a.mode}
                </span>
              </div>
              <span className="shrink-0 text-[11px] text-[var(--color-muted)]">
                {new Date(a.createdAt).toLocaleTimeString()}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
