import Link from "next/link";

const tabs = [
  { href: "/debug", label: "Workspace" },
  { href: "/debug/chat", label: "AI Chat" },
  { href: "/debug/tx", label: "Tx Inspector" },
  { href: "/debug/repair", label: "Repair" },
  { href: "/debug/memory", label: "Memory" },
];

export default function DebugLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="border-b border-[var(--color-line)] bg-[rgba(8,10,14,0.95)] px-4 py-3 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-accent)]">
              Phase 1 · Vane Debug
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
              Crypto-native workspace
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--color-muted)]">
              Paste a transaction, connect a project, map wallets and contracts — simulate before
              anything reaches a live chain.
            </p>
          </div>
          <span className="rounded-full border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-warn)]">
            Simulation mode default
          </span>
        </div>
        <nav className="mt-4 flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="shrink-0 rounded-lg px-3 py-2 text-sm text-[var(--color-muted)] hover:bg-white/5 hover:text-[var(--color-fg)]"
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
