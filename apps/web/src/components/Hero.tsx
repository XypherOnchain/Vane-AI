"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { SearchBox } from "./SearchBox";

export function Hero() {
  return (
    <section className="container" style={{ padding: "5.5rem 0 4rem" }}>
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <p
          className="mono muted"
          style={{ letterSpacing: "0.12em", textTransform: "uppercase", fontSize: "0.75rem" }}
        >
          Live intelligence network
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: "clamp(2.8rem, 7vw, 5.2rem)",
            lineHeight: 0.95,
            letterSpacing: "-0.045em",
            margin: "1rem 0 1.25rem",
            maxWidth: 920,
          }}
        >
          Vane
        </h1>
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1.45rem, 3vw, 2.15rem)",
            fontWeight: 600,
            letterSpacing: "-0.03em",
            margin: "0 0 1rem",
            maxWidth: 720,
          }}
        >
          Know who is behind the token.
        </p>
        <p className="muted" style={{ maxWidth: 560, fontSize: "1.05rem", lineHeight: 1.55 }}>
          Vane traces wallets, detects hidden clusters, monitors every launch, and explains
          Robinhood Chain in real time.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        style={{ marginTop: "2.5rem", maxWidth: 760 }}
      >
        <SearchBox large />
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
          <Link href="/radar" className="btn">
            Explore Radar
          </Link>
          <Link href="/ask" className="btn">
            Ask Vane
          </Link>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45, duration: 0.8 }}
        style={{
          marginTop: "4.5rem",
          borderTop: "1px solid var(--line)",
          paddingTop: "1.5rem",
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "1.5rem",
        }}
        className="hero-strip"
      >
        {[
          ["One paste", "Token, wallet, or tx → full investigation"],
          ["Evidence first", "Clusters show why — not just lines"],
          ["Always watching", "Missions and alerts that stay on"],
        ].map(([t, d]) => (
          <div key={t}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>{t}</div>
            <div className="muted" style={{ marginTop: 6, fontSize: "0.92rem" }}>
              {d}
            </div>
          </div>
        ))}
      </motion.div>
      </section>
  );
}
