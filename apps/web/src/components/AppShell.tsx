"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { GlobalSearch } from "./GlobalSearch";

const nav = [
  { href: "/debug", label: "Debug" },
  { href: "/radar", label: "Radar" },
  { href: "/new-pairs", label: "New Pairs" },
  { href: "/trending", label: "Trending" },
  { href: "/app/watchlists", label: "Watchlists" },
  { href: "/app/alerts", label: "Alerts" },
  { href: "/ask", label: "Ask Vane" },
];

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
              <span className="text-xs text-[var(--color-muted)]">Crypto workspace</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/debug"
                className="text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              >
                Debug
              </Link>
              <Link
                href="/radar"
                className="text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              >
                Radar
              </Link>
              <Link href="/ask" className="text-[var(--color-muted)] hover:text-[var(--color-fg)]">
                Ask Vane
              </Link>
              <Link
                href="/debug"
                className="rounded-full bg-[var(--color-accent)] px-4 py-2 font-semibold text-[#04140d]"
              >
                Open Debug
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
              href="/"
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
        <nav className="flex flex-1 flex-col gap-1 px-2 py-2">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
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
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[var(--color-line)] bg-[rgba(7,9,12,0.8)] px-4 backdrop-blur-xl">
          <div className="min-w-0 flex-1">
            <GlobalSearch />
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="rounded-full border border-[var(--color-line)] px-2.5 py-1 font-mono text-[11px] text-[var(--color-muted)]">
              RH · 4663
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-2.5 py-1 text-[11px] text-[var(--color-accent)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
              Live
            </span>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--color-line)] bg-[rgba(7,9,12,0.92)] backdrop-blur-xl md:hidden">
          {[
            { href: "/debug", label: "Debug" },
            { href: "/radar", label: "Radar" },
            { href: "/ask", label: "Ask" },
            { href: "/app/alerts", label: "Alerts" },
          ].map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className="flex-1 py-3 text-center text-xs text-[var(--color-muted)]"
            >
              {i.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
