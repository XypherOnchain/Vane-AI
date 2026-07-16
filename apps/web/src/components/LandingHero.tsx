"use client";

import Link from "next/link";
import { motion } from "framer-motion";

/**
 * Marketing surface for Vane Debug — Cursor for crypto.
 * One composition, brand-first, no radar / trading clutter.
 */
export function LandingHero() {
  return (
    <section className="relative mx-auto min-h-[calc(100vh-4rem)] w-[min(1120px,calc(100%-2rem))] pb-24 pt-20 md:pt-28">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-3xl"
      >
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(3.5rem,10vw,6.5rem)] font-extrabold leading-[0.9] tracking-[-0.05em]">
          Vane
        </h1>
        <p className="mt-5 font-[family-name:var(--font-display)] text-[clamp(1.35rem,3vw,2rem)] font-semibold tracking-[-0.03em] text-[var(--color-fg)]">
          Cursor for crypto.
        </p>
        <p className="mt-4 max-w-lg text-[1.05rem] leading-relaxed text-[var(--color-muted)]">
          Debug transactions, understand contracts, and safely operate on-chain workflows — from a
          downloadable workspace with Telegram as remote control.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/debug"
            className="rounded-full bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-[#04140d]"
          >
            Open Debug workspace
          </Link>
          <Link
            href="/debug/tx"
            className="rounded-full border border-[var(--color-line)] px-6 py-3 text-sm text-[var(--color-fg)] hover:bg-white/5"
          >
            Inspect a transaction
          </Link>
        </div>
      </motion.div>

      <motion.ul
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.7 }}
        className="mt-24 grid max-w-3xl gap-8 border-t border-[var(--color-line)] pt-10 sm:grid-cols-3"
      >
        {[
          ["Debug", "Paste a hash → revert, logs, risks, repair path"],
          ["Memory", "Repos, wallets, contracts, and incidents as a graph"],
          ["Safe by default", "Simulate first. Never live without approval"],
        ].map(([t, d]) => (
          <li key={t}>
            <div className="font-[family-name:var(--font-display)] font-bold">{t}</div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{d}</p>
          </li>
        ))}
      </motion.ul>
    </section>
  );
}
