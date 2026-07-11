"use client";

import { useMemo, useState } from "react";
import type { GraphEdge, GraphNode } from "@vane/shared-types";
import { shortAddress } from "@vane/shared-types";

const categoryFill: Record<GraphNode["category"], string> = {
  deployer: "rgba(61,255,168,0.85)",
  deployer_linked: "rgba(107,140,255,0.75)",
  probable_cluster: "rgba(255,176,32,0.65)",
  liquidity_pool: "rgba(190,140,255,0.6)",
  contract: "rgba(150,150,170,0.55)",
  smart_wallet: "rgba(61,255,168,0.4)",
  unclassified: "rgba(120,160,210,0.5)",
};

const categoryLabel: Record<GraphNode["category"], string> = {
  deployer: "Deployer",
  deployer_linked: "Same deployer",
  probable_cluster: "Probable cluster",
  liquidity_pool: "Liquidity pool",
  contract: "Contract",
  smart_wallet: "Smart wallet",
  unclassified: "Holder",
};

function hrefFor(node: GraphNode): string {
  if (node.category === "deployer_linked" || node.category === "contract") {
    return `/token/${node.address}`;
  }
  if (node.category === "liquidity_pool") return `/token/${node.address}`;
  return `/wallet/${node.address}`;
}

export function BubbleGraph({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const [selected, setSelected] = useState<GraphEdge | null>(edges[0] ?? null);
  const [hovered, setHovered] = useState<string | null>(null);

  const layout = useMemo(() => {
    const cx = 420;
    const cy = 300;
    const placed = new Map<string, { x: number; y: number; r: number; node: GraphNode }>();
    // Center node = the largest one (the token itself in indexed graphs).
    const center = [...nodes].sort((a, b) => b.size - a.size)[0];
    const ringOf = (n: GraphNode) => {
      if (center && n.id === center.id) return -1;
      if (n.category === "deployer") return 0;
      if (n.category === "liquidity_pool") return 0;
      if (n.category === "deployer_linked") return 2;
      if (n.category === "probable_cluster") return 1;
      return 1; // holders
    };
    const rings = new Map<number, GraphNode[]>();
    for (const n of nodes) {
      const ring = ringOf(n);
      if (!rings.has(ring)) rings.set(ring, []);
      rings.get(ring)!.push(n);
    }
    for (const [ring, members] of rings) {
      if (ring === -1) {
        const n = members[0]!;
        placed.set(n.id, { x: cx, y: cy, r: Math.min(44, Math.max(20, n.size)), node: n });
        continue;
      }
      const radius = 110 + ring * 95;
      members.forEach((n, idx) => {
        const angle = (idx / Math.max(1, members.length)) * Math.PI * 2 - Math.PI / 2;
        placed.set(n.id, {
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
          r: Math.max(9, Math.min(36, n.size)),
          node: n,
        });
      });
    }
    return placed;
  }, [nodes]);

  const legendCategories = useMemo(
    () => [...new Set(nodes.map((n) => n.category))],
    [nodes],
  );

  return (
    <div>
      <div className="flex flex-wrap gap-3 text-xs text-[var(--color-muted)]">
        {legendCategories.map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ background: categoryFill[c] }}
            />
            {categoryLabel[c]}
          </span>
        ))}
      </div>
      <svg viewBox="0 0 840 600" className="mt-3 w-full rounded-2xl bg-black/25">
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
              stroke={active ? "#3dffa8" : "rgba(238,242,246,0.16)"}
              strokeWidth={active ? 2.5 : 1}
              onClick={() => setSelected(e)}
              style={{ cursor: "pointer" }}
            />
          );
        })}
        {[...layout.values()].map(({ x, y, r, node }) => {
          const label = node.label ?? shortAddress(node.address);
          const isHover = hovered === node.id;
          return (
            <a key={node.id} href={hrefFor(node)}>
              <g
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={isHover ? r * 1.12 : r}
                  fill={categoryFill[node.category]}
                  stroke={isHover ? "#3dffa8" : "rgba(255,255,255,0.35)"}
                  strokeWidth={isHover ? 2 : 1}
                />
                {(r >= 13 || isHover) && (
                  <text
                    x={x}
                    y={y + r + 13}
                    textAnchor="middle"
                    fill={isHover ? "#eef2f6" : "rgba(238,242,246,0.65)"}
                    fontSize={11}
                    fontFamily="var(--font-mono, monospace)"
                  >
                    {label}
                  </text>
                )}
                <title>
                  {categoryLabel[node.category]}: {label} ({shortAddress(node.address, 6)})
                </title>
              </g>
            </a>
          );
        })}
      </svg>
      {selected && (
        <div className="mt-4 border-t border-[var(--color-line)] pt-4">
          <div className="font-[family-name:var(--font-display)] font-bold">
            {selected.relation.replaceAll("_", " ")}
          </div>
          <p className="mt-2 text-sm">{selected.why}</p>
          <p className="mt-2 font-mono text-xs text-[var(--color-muted)]">
            {shortAddress(selected.from)} → {shortAddress(selected.to)} ·{" "}
            {Math.round(selected.confidence * 100)}% ·{" "}
            {selected.confirmed ? "confirmed" : "inferred"}
          </p>
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            Click any edge for its evidence; click a bubble to open that address.
          </p>
        </div>
      )}
    </div>
  );
}
