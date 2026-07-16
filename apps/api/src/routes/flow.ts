import { Router } from "express";
import { getGraph, getRun, listGraphs, parseWorkflowNl, runWorkflow } from "@vane/workflow";

/**
 * Phase 3 — Vane Flow (workflow IR + runner + TG approval payload).
 */
export function flowRouter(): Router {
  const router = Router();

  router.get("/workflows", (_req, res) => {
    res.json({ items: listGraphs() });
  });

  router.post("/workflows", (req, res) => {
    const nl = String(req.body?.nl ?? req.body?.prompt ?? "");
    if (!nl.trim()) return res.status(400).json({ error: "nl required" });
    const graph = parseWorkflowNl(nl, req.body?.name ? String(req.body.name) : undefined);
    res.status(201).json(graph);
  });

  router.get("/workflows/:id", (req, res) => {
    const g = getGraph(req.params.id);
    if (!g) return res.status(404).json({ error: "not found" });
    res.json(g);
  });

  router.post("/workflows/:id/run", (req, res) => {
    try {
      const run = runWorkflow(req.params.id, { approve: Boolean(req.body?.approve) });
      res.json(run);
    } catch (e) {
      res.status(404).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  router.get("/runs/:id", (req, res) => {
    const run = getRun(req.params.id);
    if (!run) return res.status(404).json({ error: "not found" });
    res.json(run);
  });

  /** Telegram approval card — high value opens desktop/wallet, not chat signature. */
  router.post("/approvals/telegram", (req, res) => {
    const runId = String(req.body?.runId ?? "");
    const chatId = req.body?.telegramChatId ? String(req.body.telegramChatId) : null;
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const message = [
      "Vane Flow — approval required",
      `Run: ${runId}`,
      "Open desktop / wallet to sign. Chat buttons never sign for meaningful value.",
      `Desktop: vane://flow/runs/${runId}`,
      `Web: ${appUrl}/flow?run=${runId}`,
    ].join("\n");
    res.json({
      chatId,
      message,
      buttons: [
        { label: "Open desktop", url: `vane://flow/runs/${runId}` },
        { label: "Review", url: `${appUrl}/flow?run=${runId}` },
      ],
      signInChat: false,
    });
  });

  return router;
}
