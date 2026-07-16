"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";

interface ChatAnswer {
  answer: string;
  citations?: { label: string; href?: string; kind?: string }[];
  toolsUsed?: string[];
  suggestedFollowUps?: string[];
  redacted?: boolean;
}

function ChatInner() {
  const searchParams = useSearchParams();
  const [input, setInput] = useState("");
  const [projectId, setProjectId] = useState("");
  const [log, setLog] = useState<
    { role: "user" | "vane"; text: string; citations?: ChatAnswer["citations"]; tools?: string[] }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    void apiGet<{ items: { id: string }[] }>("/v1/debug/projects")
      .then((d) => {
        if (d.items[0]) setProjectId(d.items[0].id);
      })
      .catch(() => undefined);
  }, []);

  async function ask(q: string) {
    if (!q.trim()) return;
    setLog((l) => [...l, { role: "user", text: q }]);
    setBusy(true);
    try {
      const answer = await apiPost<ChatAnswer>("/v1/debug/chat", {
        question: q,
        projectId: projectId || undefined,
      });
      setLog((l) => [
        ...l,
        {
          role: "vane",
          text:
            answer.answer +
            (answer.redacted ? "\n\n_(secrets redacted)_" : "") +
            (answer.suggestedFollowUps?.length
              ? `\n\nFollow-ups: ${answer.suggestedFollowUps.join(" · ")}`
              : ""),
          citations: answer.citations,
          tools: answer.toolsUsed,
        },
      ]);
    } catch (e) {
      setLog((l) => [
        ...l,
        { role: "vane", text: e instanceof Error ? e.message : "Request failed" },
      ]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !seeded) {
      setSeeded(true);
      setInput("");
      void ask(q);
    }
  }, [searchParams, seeded]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col px-4 py-8 md:px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-accent)]">
        Screen 2 · Tool chat
      </p>
      <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">AI chat</h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Tools: inspect_tx, get_project, search_repo, list_incidents, propose_repair. Answers cite tx
        hashes, files, and incident ids.
      </p>
      <input
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        placeholder="project id"
        className="mt-4 w-full max-w-md rounded-lg border border-[var(--color-line)] bg-black/30 px-3 py-2 font-mono text-xs"
      />
      <div className="mt-4 min-h-[320px] flex-1 space-y-3 rounded-xl border border-[var(--color-line)] p-4">
        {log.length === 0 && (
          <p className="text-sm text-[var(--color-muted)]">
            Try: “Why did 0x… fail?” · “What is in this project?” · “List incidents” · “Propose a
            repair for 0x…”
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
            {m.tools?.length ? (
              <span className="ml-2 font-mono text-[10px] text-[var(--color-accent)]">
                {m.tools.join(", ")}
              </span>
            ) : null}
            <div className="mt-1">{m.text}</div>
            {m.citations && m.citations.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-[var(--color-muted)]">
                {m.citations.map((c, j) => (
                  <li key={j}>
                    {c.href ? (
                      <Link href={c.href.replace(/^https?:\/\/[^/]+/, "")} className="text-[var(--color-accent)]">
                        {c.label}
                      </Link>
                    ) : (
                      c.label
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const q = input.trim();
              setInput("");
              void ask(q);
            }
          }}
          placeholder="Ask Vane or paste a tx hash…"
          className="flex-1 rounded-lg border border-[var(--color-line)] bg-black/30 px-3 py-2.5 text-sm"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const q = input.trim();
            setInput("");
            void ask(q);
          }}
          className="rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[#04140d] disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default function DebugChatPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[var(--color-muted)]">Loading chat…</div>}>
      <ChatInner />
    </Suspense>
  );
}
