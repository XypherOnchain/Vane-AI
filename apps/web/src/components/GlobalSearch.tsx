"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { classifySearchInput, isLikelyTx } from "@vane/shared-types";

/** Debug-oriented search: tx → inspector, anything else → AI chat. */
export function GlobalSearch({ large = false }: { large?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (isLikelyTx(trimmed) || classifySearchInput(trimmed) === "tx") {
      router.push(`/debug/tx?hash=${encodeURIComponent(trimmed.toLowerCase())}`);
      return;
    }
    router.push(`/debug/chat?q=${encodeURIComponent(trimmed)}`);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    go(q);
  }

  return (
    <form onSubmit={onSubmit} className="relative w-full">
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={
          large
            ? "Paste a transaction hash or ask why a workflow failed…"
            : "Tx hash or question… (/)"
        }
        className={`w-full rounded-xl border border-[var(--color-line)] bg-black/30 px-4 text-[var(--color-fg)] outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)]/40 ${
          large ? "py-4 text-base" : "py-2.5 text-sm"
        }`}
      />
    </form>
  );
}
