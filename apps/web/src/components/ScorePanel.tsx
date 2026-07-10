"use client";

import type { ScoreBreakdown } from "@vane/shared";

export function ScorePanel({ score }: { score: ScoreBreakdown }) {
  const rows: [string, number, number, string[]][] = [
    ["Contract Integrity", score.contractIntegrity, 20, score.evidence.contractIntegrity ?? []],
    ["Distribution", score.distribution, 20, score.evidence.distribution ?? []],
    ["Developer History", score.developerHistory, 15, score.evidence.developerHistory ?? []],
    ["Liquidity Quality", score.liquidityQuality, 15, score.evidence.liquidityQuality ?? []],
    ["Market Integrity", score.marketIntegrity, 10, score.evidence.marketIntegrity ?? []],
    ["Wallet Quality", score.walletQuality, 10, score.evidence.walletQuality ?? []],
    ["Momentum", score.momentum, 10, score.evidence.momentum ?? []],
    ["Social", score.social, 5, score.evidence.social ?? []],
  ];

  return (
    <section className="panel" style={{ marginTop: "1rem" }}>
      <h2 style={{ fontFamily: "var(--font-display)" }}>Vane Score evidence</h2>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        Every point is deterministic. This is not a promise the token will rise or is safe.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        {rows.map(([label, value, max, evidence]) => (
          <div key={label}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span>{label}</span>
              <span className="mono">
                {value}/{max}
              </span>
            </div>
            <div
              style={{
                height: 6,
                background: "rgba(255,255,255,0.06)",
                borderRadius: 99,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${(value / max) * 100}%`,
                  height: "100%",
                  background: "var(--accent)",
                }}
              />
            </div>
            <div className="muted" style={{ fontSize: "0.8rem", marginTop: 6 }}>
              {evidence.join(" · ")}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
