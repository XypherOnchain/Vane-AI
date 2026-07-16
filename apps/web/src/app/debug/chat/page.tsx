"use client";

import { useState } from "react";
import Link from "next/link";
import { apiPost, apiGetSlow } from "@/lib/api";

export default function DebugChatPage() {
  const [input, setInput] = useState("");
  const [log, setLog] = useState<{ role: "user" | "vane"; text: string }[]>([]);
  const [busy, setBusy] = useState(false);

  async function send() {
    const q = input.trim();
    if (!q) return;
    setInput("");
    setLog((l) => [...l, { role: "user", text: q }]);
    setBusy(true);
    try {
      const txMatch = q.match(/0x[a-fA-F0-9]{64}/);
      if (txMatch) {
        const inspection = await apiGetSlow<{
          summary: string;
          status: string;
          revertReason: string | null;
          hash: string;
        }>(`/v1/debug/tx/${txMatch[0]}`);
        setLog((l) => [
          ...l,
          {
            role: "vane",
            text: `[${inspection.status}] ${inspection.summary}${
              inspection.revertReason ? `\nRevert: ${inspection.revertReason}` : ""
            }\n\nOpen inspector: /debug/tx (hash prefilled via Inspect)`,
          },
        ]);
      } else {
        const answer = await apiPost<{ answer: string; suggestedFollowUps?: string[] }>(
          "/v1/ai/query",
          { question: q },
        );
        setLog((l) => [
          ...l,
          {
            role: "vane",
            text:
              answer.answer +
              (answer.suggestedFollowUps?.length
                ? `\n\nFollow-ups: ${answer.suggestedFollowUps.join(" · ")}`
                : ""),
          },
        ]);
      }
    } catch (e) {
      setLog((l) => [
        ...l,
        { role: "vane", text: e instanceof Error ? e.message : "Request failed" },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col px-4 py-8 md:px-8">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">AI chat</h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Paste a transaction hash for RPC inspection, or ask a project question. Keys are never sent
        to the model.
      </p>
      <div className="mt-6 min-h-[320px] flex-1 space-y-3 rounded-xl border border-[var(--color-line)] p-4">
        {log.length === 0 && (
          <p className="text-sm text-[var(--color-muted)]">
            Try: “Why did 0x… fail?” or “What wallets are in my treasury project?”
          </p>
        )}
        {log.map((m, i) => (
          <div
            key={i}
            className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
              m.role === "user"
                ? "ml-8 bg-white/5"
                : "mr-8 border border-[var(--color-line)] bg-black/20"
            }`}
          >
            <span className="text-[10px] uppercase text-[var(--color-muted)]">{m.role}</span>
            <div className="mt-1">{m.text}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void send()}
          placeholder="Ask Vane or paste a tx hash…"
          className="flex-1 rounded-lg border border-[var(--color-line)] bg-black/30 px-3 py-2.5 text-sm"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void send()}
          className="rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[#04140d] disabled:opacity-50"
        >
          Send
        </button>
      </div>
      <Link href="/debug/tx" className="mt-4 text-sm text-[var(--color-accent)]">
        Prefer the full Tx Inspector →
      </Link>
    </div>
  );
}
