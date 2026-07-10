"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  classifySearchInput,
  isLikelyAddress,
  isLikelyTx,
  type SearchResult,
} from "@vane/shared-types";
import { API } from "@/lib/api";

export function GlobalSearch({ large = false }: { large?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/v1/search?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { results: SearchResult[] };
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  function go(value: string) {
    const kind = classifySearchInput(value);
    if (kind === "tx") {
      router.push(`/transaction/${value.toLowerCase()}`);
    } else if (kind === "address") {
      router.push(`/token/${value.toLowerCase()}`);
    } else if (kind === "question") {
      router.push(`/ask?q=${encodeURIComponent(value)}`);
    } else {
      router.push(`/radar?q=${encodeURIComponent(value)}`);
    }
    setOpen(false);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    go(q.trim());
  }

  return (
    <div className="relative w-full">
      <form onSubmit={onSubmit}>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Paste a token, wallet, or transaction"
          className={`w-full rounded-xl border border-[var(--color-line)] bg-[rgba(14,18,24,0.9)] text-[var(--color-fg)] outline-none placeholder:text-[var(--color-muted)] focus:border-[rgba(61,255,168,0.45)] focus:shadow-[0_0_0_3px_var(--color-accent-dim)] ${
            large ? "px-5 py-4 text-base" : "px-4 py-2.5 text-sm"
          }`}
        />
      </form>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] shadow-2xl">
          {results.map((r) => (
            <button
              key={`${r.type}-${r.id}`}
              type="button"
              className="flex w-full items-start justify-between gap-3 border-b border-[var(--color-line)] px-4 py-3 text-left last:border-0 hover:bg-white/5"
              onClick={() => {
                if (r.type === "token") router.push(`/token/${r.id}`);
                else if (r.type === "wallet") router.push(`/wallet/${r.id}`);
                else if (r.type === "tx") router.push(`/transaction/${r.id}`);
                else go(r.id);
                setOpen(false);
              }}
            >
              <div>
                <div className="text-sm font-medium">{r.title}</div>
                {r.subtitle && (
                  <div className="mt-0.5 font-mono text-xs text-[var(--color-muted)]">{r.subtitle}</div>
                )}
              </div>
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                {r.type}
              </span>
            </button>
          ))}
          {isLikelyAddress(q) && (
            <button
              type="button"
              className="w-full px-4 py-2 text-left text-xs text-[var(--color-muted)] hover:bg-white/5"
              onClick={() => {
                router.push(`/wallet/${q.toLowerCase()}`);
                setOpen(false);
              }}
            >
              Open as address / wallet
            </button>
          )}
        </div>
      )}
      {!large && (
        <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-[var(--color-line)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-muted)] sm:inline">
          /
        </span>
      )}
    </div>
  );
}

void isLikelyTx;
