import Link from "next/link";
import type { GraphEdge, GraphNode } from "@vane/shared-types";
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
    <div className="px-4 py-8 pb-24 md:px-8">
      <p className="font-mono text-[11px] text-[var(--color-muted)]">VANE GRAPH</p>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
        Holder relationships
      </h1>
      <p className="mt-2 max-w-xl text-sm text-[var(--color-muted)]">
        Connections are observed relationships with evidence — not automatic proof of common ownership.
      </p>
      <Link href={`/token/${address}`} className="mt-4 inline-block text-sm text-[var(--color-accent)]">
        ← Back to scan
      </Link>
      <div className="mt-6">
        {graph ? <BubbleGraph nodes={graph.nodes} edges={graph.edges} /> : (
          <p className="text-[var(--color-muted)]">Graph unavailable.</p>
        )}
      </div>
    </div>
  );
}
