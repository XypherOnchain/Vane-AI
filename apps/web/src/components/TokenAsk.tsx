"use client";

import { FormEvent, useState } from "react";
import type { AgentAnswer } from "@vane/shared-types";
import { API } from "@/lib/api";

export function TokenAsk({ tokenAddress }: { tokenAddress: string }) {
  const [q, setQ] = useState("What is the biggest risk?");
  const [answer, setAnswer] = useState<AgentAnswer | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API}/v1/ai/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, tokenAddress }),
      });
      setAnswer((await res.json()) as AgentAnswer);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 border-t border-[var(--color-line)] pt-6">
      <h3 className="font-[family-name:var(--font-display)] text-lg font-bold">Ask Vane</h3>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Tool-calling only — deterministic services own the facts.
      </p>
      <form onSubmit={onSubmit} className="mt-4 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[220px] flex-1 rounded-xl border border-[var(--color-line)] bg-[rgba(14,18,24,0.9)] px-4 py-2.5 text-sm outline-none focus:border-[rgba(61,255,168,0.45)]"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#04140d]"
        >
          {loading ? "…" : "Ask"}
        </button>
      </form>
      {answer && (
        <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{answer.answer}</div>
      )}
    </div>
  );
}
