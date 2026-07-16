import Link from "next/link";

export default function RepairPage() {
  return (
    <div className="px-4 py-8 md:px-8">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">Repair loop</h2>
      <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">
        From a failed transaction Vane will propose a patch, generate a regression test, run a fork
        simulation, and require approval before anything hits a live chain.
      </p>
      <ol className="mt-8 max-w-xl space-y-4 text-sm">
        {[
          "Inspect the transaction (Tx Inspector)",
          "Save an incident into Project Memory",
          "Review the proposed patch (simulation mode only)",
          "Run the generated test on a fork",
          "Human approval gate → then external wallet signing (Phase 3+)",
        ].map((step, i) => (
          <li key={step} className="flex gap-3 rounded-xl border border-[var(--color-line)] p-4">
            <span className="font-mono text-[var(--color-accent)]">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-6 rounded-lg border border-[var(--color-warn)]/30 bg-[var(--color-warn)]/10 px-4 py-3 text-sm text-[var(--color-warn)]">
        Live broadcast is intentionally unavailable in Phase 1. Vane Debug stops at simulate +
        approve.
      </p>
      <Link
        href="/debug/tx"
        className="mt-6 inline-flex rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-[#04140d]"
      >
        Start from a transaction
      </Link>
    </div>
  );
}
