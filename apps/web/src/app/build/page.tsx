"use client";

import { useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

export default function BuildPage() {
  const [entitlements, setEntitlements] = useState<Record<string, unknown> | null>(null);
  const [manifest, setManifest] = useState<string>("");
  const [scan, setScan] = useState<string>("");

  return (
    <div className="px-4 py-8 md:px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-accent)]">
        Phase 2 · Build
      </p>
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold">Repo intelligence</h2>
      <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">
        ABI-aware helpers, protocol templates, secret scanning, deploy manifests. Use the VS Code /
        Cursor extension for file + selection context.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm"
          onClick={() =>
            void apiGet<Record<string, unknown>>("/v1/build/entitlements").then(setEntitlements)
          }
        >
          Entitlements
        </button>
        <button
          type="button"
          className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm"
          onClick={() =>
            void apiPost("/v1/build/templates/uniswap", {}).then((t) =>
              setManifest(JSON.stringify(t, null, 2)),
            )
          }
        >
          Uniswap template
        </button>
        <button
          type="button"
          className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#04140d]"
          onClick={() =>
            void apiPost("/v1/build/deploy-manifest", { name: "TreasuryVault" }).then((t) =>
              setManifest(JSON.stringify(t, null, 2)),
            )
          }
        >
          Deploy manifest
        </button>
        <button
          type="button"
          className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm"
          onClick={() =>
            void apiPost<{ findings: unknown[] }>("/v1/build/secret-scan", {}).then((r) =>
              setScan(JSON.stringify(r, null, 2)),
            )
          }
        >
          Secret scan
        </button>
      </div>
      {entitlements && (
        <pre className="mt-6 max-w-xl overflow-auto rounded-lg bg-black/40 p-3 text-xs">
          {JSON.stringify(entitlements, null, 2)}
        </pre>
      )}
      {manifest && (
        <pre className="mt-4 max-w-2xl overflow-auto rounded-lg bg-black/40 p-3 text-xs">{manifest}</pre>
      )}
      {scan && (
        <pre className="mt-4 max-w-2xl overflow-auto rounded-lg bg-black/40 p-3 text-xs">{scan}</pre>
      )}
      <p className="mt-8 text-sm text-[var(--color-muted)]">
        Extension: <code className="font-mono">apps/vscode-extension</code> — commands Add chain
        support, Explain call path, Generate deploy manifest.
      </p>
    </div>
  );
}
