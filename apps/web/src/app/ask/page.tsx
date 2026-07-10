"use client";

import { FormEvent, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { AgentAnswer } from "@vane/shared";
import { API } from "@/lib/api";
import { SearchBox } from "@/components/SearchBox";

function AskInner() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "Is this token bundled?");
  const [answer, setAnswer] = useState<AgentAnswer | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API}/v1/agent`, {
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
    <div className="container" style={{ padding: "2.5rem 0 4rem" }}>
      <h1 style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>Ask Vane</h1>
      <p className="muted" style={{ maxWidth: 560, marginBottom: "1.5rem" }}>
        Natural-language investigation with evidence citations. Include a token or wallet address.
      </p>
      <div style={{ maxWidth: 640, marginBottom: "2rem" }}>
        <SearchBox />
      </div>
      <form onSubmit={onSubmit} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <input className="field" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "…" : "Ask"}
        </button>
      </form>
      {answer && (
        <div className="panel" style={{ marginTop: "1.5rem", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
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
