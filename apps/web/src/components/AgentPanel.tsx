"use client";

import { FormEvent, useState } from "react";
import type { AgentAnswer } from "@vane/shared";
import { API } from "@/lib/api";

export function AgentPanel({ tokenAddress }: { tokenAddress?: string }) {
  const [q, setQ] = useState("What is the biggest risk?");
  const [answer, setAnswer] = useState<AgentAnswer | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API}/v1/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, tokenAddress }),
      });
      setAnswer((await res.json()) as AgentAnswer);
    } catch {
      setAnswer(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel" style={{ marginTop: "1rem" }}>
      <h2 style={{ fontFamily: "var(--font-display)" }}>Ask Vane</h2>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        The model chooses tools. Deterministic services own the facts.
      </p>
      <form onSubmit={onSubmit} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <input className="field" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
        <button className="btn btn-primary" disabled={loading} type="submit">
          {loading ? "Thinking…" : "Ask"}
        </button>
      </form>
      {answer && (
        <div style={{ marginTop: "1.25rem" }}>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{answer.answer}</div>
          {answer.citations.length > 0 && (
            <div style={{ marginTop: "0.75rem", display: "flex", gap: 12, flexWrap: "wrap" }}>
              {answer.citations.map((c) => (
                <a key={c.href} href={c.href} className="muted" style={{ fontSize: "0.85rem" }}>
                  {c.label} →
                </a>
              ))}
            </div>
          )}
          <div style={{ marginTop: "0.75rem", display: "flex", gap: 8, flexWrap: "wrap" }}>
            {answer.suggestedFollowUps.map((s) => (
              <button key={s} type="button" className="btn" style={{ padding: "0.4rem 0.75rem" }} onClick={() => setQ(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
