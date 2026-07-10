"use client";

import { useMemo, useState } from "react";
import type { GraphEdge, GraphNode } from "@vane/shared-types";
import { shortAddress } from "@vane/shared-types";

const categoryFill: Record<GraphNode["category"], string> = {
  deployer: "rgba(61,255,168,0.75)",
  deployer_linked: "rgba(107,140,255,0.7)",
  probable_cluster: "rgba(255,176,32,0.6)",
  liquidity_pool: "rgba(180,180,200,0.55)",
  contract: "rgba(150,150,170,0.5)",
  smart_wallet: "rgba(61,255,168,0.35)",
  unclassified: "rgba(120,150,200,0.4)",
};

export function BubbleGraph({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const [selected, setSelected] = useState<GraphEdge | null>(edges[0] ?? null);
  const [t, setT] = useState(100);

  const layout = useMemo(() => {
    const cx = 420;
    const cy = 280;
    const placed = new Map<string, { x: number; y: number; r: number; node: GraphNode }>();
    const ringOf = (n: GraphNode) =>
      n.category === "deployer" ? 0 : n.category === "deployer_linked" ? 1 : n.category === "probable_cluster" ? 2 : 3;
    nodes.forEach((n, i) => {
      const ring = ringOf(n);
      const peers = nodes.filter((x) => ringOf(x) === ring);
      const idx = peers.indexOf(n);
      const radius = 40 + ring * 90;
      const angle = (idx / Math.max(1, peers.length)) * Math.PI * 2 + i * 0.02;
      placed.set(n.id, {
        x: cx + Math.cos(angle) * radius * (0.7 + t / 300),
        y: cy + Math.sin(angle) * radius * (0.7 + t / 300),
        r: Math.max(8, Math.min(36, n.size * (0.6 + t / 250))),
        node: n,
      });
    });
    return placed;
  }, [nodes, t]);

  return (
    <div>
      <label className="text-sm text-[var(--color-muted)]">
        Timeline — Launch → Now ({t}%)
        <input
          type="range"
          min={0}
          max={100}
          value={t}
          onChange={(e) => setT(Number(e.target.value))}
          className="mt-2 w-full"
        />
      </label>
      <svg
        viewBox="0 0 840 560"
        className="mt-4 w-full rounded-2xl bg-black/25"
      >
        {edges.map((e) => {
          const a = layout.get(e.from);
          const b = layout.get(e.to);
          if (!a || !b) return null;
          const active = selected?.id === e.id;
          return (
            <line
              key={e.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={active ? "#3dffa8" : "rgba(238,242,246,0.18)"}
              strokeWidth={active ? 2.5 : 1}
              onClick={() => setSelected(e)}
              style={{ cursor: "pointer" }}
            />
          );
        })}
        {[...layout.values()].map(({ x, y, r, node }) => (
          <g key={node.id}>
            <circle
              cx={x}
              cy={y}
              r={r}
              fill={categoryFill[node.category]}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth={1}
            />
            <title>{node.label ?? shortAddress(node.address)}</title>
          </g>
        ))}
      </svg>
      {selected && (
        <div className="mt-4 border-t border-[var(--color-line)] pt-4">
          <div className="font-[family-name:var(--font-display)] font-bold">
            {selected.relation.replaceAll("_", " ")}
          </div>
          <p className="mt-2 text-sm">{selected.why}</p>
          <p className="mt-2 font-mono text-xs text-[var(--color-muted)]">
            {shortAddress(selected.from)} → {shortAddress(selected.to)} ·{" "}
            {Math.round(selected.confidence * 100)}% · {selected.confirmed ? "confirmed" : "inferred"}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Evidence: {selected.evidenceIds.join(", ") || "—"}
          </p>
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            These wallets share a funding source and display coordinated behavior — not automatic proof
            of common ownership.
          </p>
        </div>
      )}
    </div>
  );
}
