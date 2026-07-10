"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/radar", label: "Radar" },
  { href: "/ask", label: "Ask Vane" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        backdropFilter: "blur(14px)",
        background: "rgba(7, 9, 12, 0.72)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 64,
          gap: "1rem",
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "baseline", gap: "0.55rem" }}>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "1.35rem",
              letterSpacing: "-0.03em",
            }}
          >
            Vane
          </span>
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            Robinhood Chain
          </span>
        </Link>
        <nav style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              style={{
                color: pathname?.startsWith(l.href) ? "var(--fg)" : "var(--muted)",
                fontSize: "0.95rem",
              }}
            >
              {l.label}
            </Link>
          ))}
          <Link href="/radar" className="btn btn-primary" style={{ padding: "0.55rem 0.95rem" }}>
            Explore
          </Link>
        </nav>
      </div>
    </header>
  );
}
