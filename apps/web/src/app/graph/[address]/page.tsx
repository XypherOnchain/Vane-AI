import Link from "next/link";
import type { GraphEdge, GraphNode } from "@vane/shared";
import { apiGet } from "@/lib/api";
import { BubbleGraph } from "@/components/BubbleGraph";

export const dynamic = "force-dynamic";

export default async function GraphPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  let graph: { nodes: GraphNode[]; edges: GraphEdge[] } | null = null;
  try {
    graph = await apiGet(`/v1/tokens/${address}/graph`);
  } catch {
    graph = null;
  }

  return (
    <div className="container" style={{ padding: "2rem 0 4rem" }}>
      <p className="mono muted" style={{ fontSize: "0.78rem" }}>
        VANE GRAPH
      </p>
      <h1 style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>
        Holder relationships
      </h1>
      <p className="muted" style={{ maxWidth: 640 }}>
        Connections are observed relationships with evidence — not automatic proof of common
        ownership.
      </p>
      <div style={{ margin: "1rem 0" }}>
        <Link href={`/token/${address}`} className="btn">
          Back to scan
        </Link>
      </div>
      {graph ? (
        <BubbleGraph nodes={graph.nodes} edges={graph.edges} />
      ) : (
        <p className="muted">Graph unavailable.</p>
      )}
    </div>
  );
}
