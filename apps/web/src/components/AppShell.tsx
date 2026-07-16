"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ModeBanner } from "./ModeBanner";

/** Product nav — Debug first; later pillars appear as routes ship. */
const nav = [
  { href: "/debug", label: "Workspace", exact: true },
  { href: "/debug/chat", label: "AI Chat" },
  { href: "/debug/tx", label: "Tx Inspector" },
  { href: "/debug/repair", label: "Repair" },
  { href: "/debug/memory", label: "Memory" },
  { href: "/build", label: "Build" },
  { href: "/flow", label: "Flow" },
  { href: "/operate", label: "Operate" },
  { href: "/agent", label: "Agent" },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMarketing = pathname === "/" || pathname === "/about" || pathname === "/pricing";
  const [collapsed, setCollapsed] = useState(false);

  if (isMarketing) {
    return (
      <>
        <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[rgba(7,9,12,0.72)] backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-[min(1120px,calc(100%-2rem))] items-center justify-between gap-4">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="font-[family-name:var(--font-display)] text-xl font-extrabold tracking-tight">
                Vane
              </span>
              <span className="text-xs text-[var(--color-muted)]">for crypto</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/debug"
                className="rounded-full bg-[var(--color-accent)] px-4 py-2 font-semibold text-[#04140d]"
              >
                Open workspace
              </Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 border-r border-[var(--color-line)] bg-[rgba(8,10,14,0.9)] md:flex md:flex-col ${
          collapsed ? "w-[72px]" : "w-[220px]"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-4">
          {!collapsed && (
            <Link
              href="/debug"
              className="font-[family-name:var(--font-display)] text-lg font-extrabold"
            >
              Vane
            </Link>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="rounded-md border border-[var(--color-line)] px-2 py-1 text-xs text-[var(--color-muted)]"
            aria-label="Toggle sidebar"
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>
        <p
          className={`px-4 pb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted)] ${
            collapsed ? "hidden" : ""
          }`}
        >
          Debug · Phase 1
        </p>
        <nav className="flex flex-1 flex-col gap-1 px-2 py-2">
          {nav.map((item) => {
            const active = isActive(pathname, item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-[var(--color-accent-dim)] text-[var(--color-accent)]"
                    : "text-[var(--color-muted)] hover:bg-white/5 hover:text-[var(--color-fg)]"
                }`}
                title={item.label}
              >
                {collapsed ? item.label.slice(0, 1) : item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[var(--color-line)] p-3">
          <span className="flex items-center gap-1.5 rounded-full border border-[var(--color-warn)]/40 px-2.5 py-1 text-[10px] uppercase tracking-wide text-[var(--color-warn)]">
            Simulation mode
          </span>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-[var(--color-line)] bg-[rgba(7,9,12,0.8)] px-4 backdrop-blur-xl">
          <p className="text-sm text-[var(--color-muted)] md:hidden">
            <Link href="/debug" className="font-[family-name:var(--font-display)] font-bold text-[var(--color-fg)]">
              Vane
            </Link>
          </p>
          <p className="hidden text-sm text-[var(--color-muted)] md:block">
            Paste a tx · connect a repo · simulate before live
          </p>
          <span className="rounded-full border border-[var(--color-line)] px-2.5 py-1 font-mono text-[11px] text-[var(--color-muted)]">
            chain 4663
          </span>
        </header>
        <ModeBanner />
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--color-line)] bg-[rgba(7,9,12,0.92)] backdrop-blur-xl md:hidden">
          {nav.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className={`flex-1 py-3 text-center text-[10px] ${
                isActive(pathname, i.href, i.exact)
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-muted)]"
              }`}
            >
              {i.label.split(" ")[0]}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
