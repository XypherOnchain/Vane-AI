"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AgentAnswer } from "@vane/shared-types";
import { API } from "@/lib/api";
import { GlobalSearch } from "@/components/GlobalSearch";

function AskInner() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "Is this token bundled?");
  const [answer, setAnswer] = useState<AgentAnswer | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API}/v1/ai/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      setAnswer((await res.json()) as AgentAnswer);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-4 py-8 pb-24 md:px-8">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
        Ask Vane
      </h1>
      <p className="mt-2 max-w-xl text-sm text-[var(--color-muted)]">
        Evidence-backed answers. Include a token or wallet address when asking about a specific
        entity.
      </p>
      <div className="mt-6 max-w-xl">
        <GlobalSearch />
      </div>
      <form onSubmit={onSubmit} className="mt-6 flex max-w-3xl flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[220px] flex-1 rounded-xl border border-[var(--color-line)] bg-[rgba(14,18,24,0.9)] px-4 py-3 text-sm outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-[#04140d]"
        >
          {loading ? "…" : "Ask"}
        </button>
      </form>
      {answer && (
        <div className="mt-6 max-w-3xl whitespace-pre-wrap rounded-xl border border-[var(--color-line)] p-5 text-sm leading-relaxed">
          {answer.answer}
        </div>
      )}
    </div>
  );
}

export default function AskPage() {
  return (
    <Suspense>
      <AskInner />
    </Suspense>
  );
}
