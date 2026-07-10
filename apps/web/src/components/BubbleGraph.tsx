"use client";

import { useMemo, useState } from "react";
import type { GraphEdge, GraphNode } from "@vane/shared";
import { shortAddress } from "@vane/shared";

export function BubbleGraph({
  nodes,
  edges,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
}) {
  const [selected, setSelected] = useState<GraphEdge | null>(edges[0] ?? null);
  const [t, setT] = useState(100); // timeline 0-100

  const layout = useMemo(() => {
    const cx = 420;
    const cy = 280;
    const placed = new Map<string, { x: number; y: number; r: number; node: GraphNode }>();
    nodes.forEach((n, i) => {
      const ring = n.isDeployer ? 0 : n.label === "Shared funder" ? 1 : n.clusterId ? 2 : 3;
      const count = nodes.filter((x) => {
        const r =
          x.isDeployer ? 0 : x.label === "Shared funder" ? 1 : x.clusterId ? 2 : 3;
        return r === ring;
      }).length;
      const idx = nodes
        .filter((x) => {
          const r =
            x.isDeployer ? 0 : x.label === "Shared funder" ? 1 : x.clusterId ? 2 : 3;
          return r === ring;
        })
        .indexOf(n);
      const radius = 40 + ring * 90;
      const angle = (idx / Math.max(1, count)) * Math.PI * 2 + i * 0.02;
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
      <div style={{ marginBottom: "1rem" }}>
        <label className="muted" style={{ fontSize: "0.85rem" }}>
          Time travel — Launch → Now ({t}%)
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={t}
          onChange={(e) => setT(Number(e.target.value))}
          style={{ width: "100%", marginTop: 8 }}
        />
      </div>
      <svg viewBox="0 0 840 560" style={{ width: "100%", height: "auto", background: "rgba(0,0,0,0.25)", borderRadius: 16 }}>
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
              fill={node.clusterId ? "rgba(255,176,32,0.55)" : node.isDeployer ? "rgba(61,255,168,0.7)" : "rgba(120,150,200,0.45)"}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth={1}
            />
            <title>{node.label ?? shortAddress(node.address)}</title>
          </g>
        ))}
      </svg>
      {selected && (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
            {selected.relation.replaceAll("_", " ")}
          </div>
          <p style={{ marginTop: 8 }}>{selected.why}</p>
          <p className="muted mono" style={{ fontSize: "0.85rem", marginTop: 8 }}>
            {shortAddress(selected.from)} → {shortAddress(selected.to)} · confidence{" "}
            {Math.round(selected.confidence * 100)}% ·{" "}
            {selected.confirmed ? "confirmed" : "inferred"}
          </p>
        </div>
      )}
    </div>
  );
}
