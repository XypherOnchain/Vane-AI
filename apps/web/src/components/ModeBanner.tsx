"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

type Mode = "simulation" | "testnet" | "live";

/**
 * Always-visible execution mode. Live is disabled in Phase 1.
 */
export function ModeBanner() {
  const [mode, setMode] = useState<Mode>("simulation");
  const [liveEnabled, setLiveEnabled] = useState(false);

  useEffect(() => {
    void apiGet<{ liveEnabled?: boolean }>("/v1/debug/meta")
      .then((m) => setLiveEnabled(Boolean(m.liveEnabled)))
      .catch(() => undefined);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-line)] bg-black/40 px-4 py-2 text-xs md:px-8">
      <span className="font-mono uppercase tracking-[0.12em] text-[var(--color-muted)]">Mode</span>
      {(["simulation", "testnet", "live"] as const).map((m) => {
        const disabled = m === "live" && !liveEnabled;
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            disabled={disabled}
            title={disabled ? "Live broadcast disabled in Phase 1" : m}
            onClick={() => setMode(m)}
            className={`rounded px-2.5 py-1 font-medium capitalize ${
              active
                ? m === "live"
                  ? "bg-[rgba(255,92,92,0.2)] text-[var(--color-danger)]"
                  : "bg-[rgba(61,255,168,0.15)] text-[var(--color-accent)]"
                : "text-[var(--color-muted)] hover:bg-white/5"
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {m}
          </button>
        );
      })}
      <span className="ml-auto text-[var(--color-muted)]">
        {mode === "live" ? "Broadcast unlocked" : "No live broadcast"}
      </span>
    </div>
  );
}
