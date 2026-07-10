"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { GlobalSearch } from "./GlobalSearch";

export function LandingHero() {
  return (
    <section className="mx-auto w-[min(1120px,calc(100%-2rem))] pb-20 pt-16 md:pt-24">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
          Intelligence layer · Robinhood Chain
        </p>
        <h1 className="mt-4 max-w-4xl font-[family-name:var(--font-display)] text-[clamp(3rem,8vw,5.5rem)] font-extrabold leading-[0.92] tracking-[-0.045em]">
          Vane
        </h1>
        <p className="mt-4 max-w-2xl font-[family-name:var(--font-display)] text-[clamp(1.4rem,3vw,2.2rem)] font-semibold tracking-[-0.03em]">
          Know who is behind the token.
        </p>
        <p className="mt-4 max-w-xl text-[1.05rem] leading-relaxed text-[var(--color-muted)]">
          Vane traces wallets, detects hidden clusters, analyzes developers, and monitors every
          Robinhood Chain launch in real time.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.65 }}
        className="mt-10 max-w-3xl"
      >
        <GlobalSearch large />
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/radar"
            className="rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-[#04140d]"
          >
            Scan
          </Link>
          <Link
            href="/new-pairs"
            className="rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm text-[var(--color-fg)] hover:bg-white/5"
          >
            Explore New Pairs
          </Link>
          <Link
            href="/ask"
            className="rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm text-[var(--color-fg)] hover:bg-white/5"
          >
            Ask Vane
          </Link>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35, duration: 0.8 }}
        className="mt-20 grid gap-8 border-t border-[var(--color-line)] pt-8 md:grid-cols-3"
      >
        {[
          ["One paste", "Token, wallet, or tx → complete investigation"],
          ["Evidence first", "Every warning links to the calculation that created it"],
          ["Same truth everywhere", "Web and Telegram share one intelligence backend"],
        ].map(([t, d]) => (
          <div key={t}>
            <div className="font-[family-name:var(--font-display)] font-bold">{t}</div>
            <p className="mt-2 text-sm text-[var(--color-muted)]">{d}</p>
          </div>
        ))}
      </motion.div>

      <section className="mt-20">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          What Vane replaces
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Token Intelligence", "Market, contract, holders, and scores in one scan"],
            ["Live Wallet Graph", "Relationships with confidence and evidence"],
            ["Bundle Detection", "Shared funders + coordinated behavior — not same-block alone"],
            ["Developer History", "Funding source, prior launches, linked supply"],
            ["AI Monitoring", "Tool-calling over deterministic services only"],
            ["New Pair Radar", "Live launches with integrity and connected-supply filters"],
          ].map(([t, d]) => (
            <div key={t} className="border-t border-[var(--color-line)] pt-4">
              <div className="font-semibold">{t}</div>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-20 border-t border-[var(--color-line)] pt-8">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">Trust</h2>
        <ul className="mt-4 space-y-2 text-sm text-[var(--color-muted)]">
          <li>No seed phrase required — read-only research by default</li>
          <li>Every conclusion includes evidence</li>
          <li>Connected-wallet findings are probabilistic unless directly confirmed</li>
          <li>Vane is not affiliated with Robinhood Markets</li>
        </ul>
      </section>
    </section>
  );
}
