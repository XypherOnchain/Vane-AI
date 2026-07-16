import { randomUUID } from "node:crypto";

export type WorkflowStatus = "pending" | "running" | "awaiting_approval" | "completed" | "failed" | "cancelled";

export interface WorkflowNode {
  id: string;
  kind: "trigger" | "simulate" | "policy" | "sign" | "broadcast" | "confirm" | "audit";
  label: string;
  config?: Record<string, unknown>;
}

export interface WorkflowGraph {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: { from: string; to: string }[];
  idempotencyKey: string;
  createdAt: string;
}

export interface WorkflowRun {
  id: string;
  graphId: string;
  status: WorkflowStatus;
  cursor: string | null;
  checkpoints: { nodeId: string; at: string; ok: boolean; note: string }[];
  requiresExternalSign: boolean;
  liveBroadcastAllowed: boolean;
}

const runs = new Map<string, WorkflowRun>();
const graphs = new Map<string, WorkflowGraph>();

/** NL → structured workflow IR (Phase 3). */
export function parseWorkflowNl(nl: string, name?: string): WorkflowGraph {
  const id = randomUUID();
  const nodes: WorkflowNode[] = [
    { id: "n1", kind: "trigger", label: "Trigger", config: { source: nl.slice(0, 200) } },
    { id: "n2", kind: "simulate", label: "Fork simulate" },
    { id: "n3", kind: "policy", label: "Policy check" },
    { id: "n4", kind: "sign", label: "External sign (WalletConnect)", config: { custody: false } },
    { id: "n5", kind: "broadcast", label: "Broadcast", config: { gated: true } },
    { id: "n6", kind: "confirm", label: "Confirm destination" },
    { id: "n7", kind: "audit", label: "Audit log" },
  ];
  const edges = nodes.slice(0, -1).map((n, i) => ({ from: n.id, to: nodes[i + 1]!.id }));
  const graph: WorkflowGraph = {
    id,
    name: name ?? "Untitled flow",
    nodes,
    edges,
    idempotencyKey: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  graphs.set(id, graph);
  return graph;
}

export function runWorkflow(graphId: string, opts?: { approve?: boolean }): WorkflowRun {
  const graph = graphs.get(graphId);
  if (!graph) throw new Error("graph not found");
  const existing = [...runs.values()].find((r) => r.graphId === graphId && r.status === "running");
  if (existing) return existing;

  const run: WorkflowRun = {
    id: randomUUID(),
    graphId,
    status: "running",
    cursor: graph.nodes[0]?.id ?? null,
    checkpoints: [],
    requiresExternalSign: true,
    liveBroadcastAllowed: false,
  };

  for (const node of graph.nodes) {
    run.cursor = node.id;
    if (node.kind === "sign" && !opts?.approve) {
      run.status = "awaiting_approval";
      run.checkpoints.push({
        nodeId: node.id,
        at: new Date().toISOString(),
        ok: false,
        note: "Waiting for external wallet signature — not chat-as-signature",
      });
      runs.set(run.id, run);
      return run;
    }
    if (node.kind === "broadcast") {
      run.checkpoints.push({
        nodeId: node.id,
        at: new Date().toISOString(),
        ok: false,
        note: "Broadcast blocked until policy + external sign (Phase 3 gate)",
      });
      run.status = "awaiting_approval";
      runs.set(run.id, run);
      return run;
    }
    run.checkpoints.push({
      nodeId: node.id,
      at: new Date().toISOString(),
      ok: true,
      note: `${node.kind} ok`,
    });
  }
  run.status = "completed";
  runs.set(run.id, run);
  return run;
}

export function getGraph(id: string): WorkflowGraph | null {
  return graphs.get(id) ?? null;
}

export function getRun(id: string): WorkflowRun | null {
  return runs.get(id) ?? null;
}

export function listGraphs(): WorkflowGraph[] {
  return [...graphs.values()];
}
