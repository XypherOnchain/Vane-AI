import { Router } from "express";
import { canRunAgentJob, DEFAULT_POLICY, type AgentJobKind } from "@vane/policy";
import { randomUUID } from "node:crypto";

/**
 * Phase 5 — Policy-constrained agent jobs only.
 */
export function agentJobsRouter(): Router {
  const router = Router();
  const jobs: {
    id: string;
    kind: AgentJobKind;
    status: string;
    decision: ReturnType<typeof canRunAgentJob>;
    createdAt: string;
  }[] = [];

  router.get("/jobs", (_req, res) => {
    res.json({ items: jobs.slice(0, 50), policy: DEFAULT_POLICY });
  });

  router.post("/jobs", (req, res) => {
    const kind = String(req.body?.kind ?? "incident_triage") as AgentJobKind;
    const nativeValueEth = Number(req.body?.nativeValueEth ?? 0);
    const humanApproved = Boolean(req.body?.humanApproved);
    const decision = canRunAgentJob(DEFAULT_POLICY, kind, { nativeValueEth, humanApproved });
    const job = {
      id: randomUUID(),
      kind,
      status: decision.allow ? "accepted" : "rejected",
      decision,
      createdAt: new Date().toISOString(),
    };
    jobs.unshift(job);
    res.status(decision.allow ? 201 : 403).json(job);
  });

  router.post("/incident-auto", (req, res) => {
    const decision = canRunAgentJob(DEFAULT_POLICY, "incident_triage", {
      humanApproved: false,
    });
    res.json({
      triage: decision.allow,
      decision,
      next: "Open Repair in desktop for irreversible steps",
      deepLink: req.body?.txHash
        ? `vane://debug/tx/${req.body.txHash}`
        : "vane://debug",
    });
  });

  return router;
}
