import { Router } from "express";
import { defaultProjectStore } from "@vane/project-graph";
import { inspectTransaction, proposeRepair } from "../services/tx-inspector.js";

/**
 * Phase 1 — Vane Debug API
 * Workspace / project memory / transaction inspector / repair stubs.
 */
export function debugRouter(): Router {
  const router = Router();
  const store = defaultProjectStore;

  router.get("/projects", (_req, res) => {
    res.json({ items: store.listProjects() });
  });

  router.post("/projects", (req, res) => {
    const project = store.createProject({
      name: String(req.body?.name ?? "Untitled project"),
      repoPath: req.body?.repoPath ? String(req.body.repoPath) : undefined,
      githubUrl: req.body?.githubUrl ? String(req.body.githubUrl) : undefined,
      chains: Array.isArray(req.body?.chains) ? req.body.chains.map(Number) : [4663],
      telegramChatId: req.body?.telegramChatId ? String(req.body.telegramChatId) : undefined,
    });
    res.status(201).json(project);
  });

  router.get("/projects/:id", (req, res) => {
    const project = store.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  });

  router.patch("/projects/:id", (req, res) => {
    const project = store.updateProject(req.params.id, {
      name: req.body?.name,
      repoPath: req.body?.repoPath,
      githubUrl: req.body?.githubUrl,
      chains: req.body?.chains,
      telegramChatId: req.body?.telegramChatId,
    });
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  });

  router.post("/projects/:id/wallets", (req, res) => {
    const address = String(req.body?.address ?? "");
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: "valid EVM address required" });
    }
    const project = store.addWallet(req.params.id, {
      address,
      role: (req.body?.role as "watch") ?? "watch",
      label: req.body?.label ? String(req.body.label) : undefined,
      chainId: req.body?.chainId ? Number(req.body.chainId) : 4663,
    });
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.status(201).json(project);
  });

  router.post("/projects/:id/contracts", (req, res) => {
    const address = String(req.body?.address ?? "");
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: "valid EVM address required" });
    }
    const project = store.addContract(req.params.id, {
      address,
      chainId: Number(req.body?.chainId ?? 4663),
      name: req.body?.name ? String(req.body.name) : undefined,
      abiPath: req.body?.abiPath ? String(req.body.abiPath) : undefined,
      deploymentTx: req.body?.deploymentTx ? String(req.body.deploymentTx) : undefined,
      isProduction: Boolean(req.body?.isProduction),
    });
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.status(201).json(project);
  });

  router.get("/incidents", (req, res) => {
    const projectId = req.query.projectId ? String(req.query.projectId) : undefined;
    res.json({ items: store.listIncidents(projectId) });
  });

  router.get("/incidents/:id", (req, res) => {
    const incident = store.getIncident(req.params.id);
    if (!incident) return res.status(404).json({ error: "Incident not found" });
    res.json(incident);
  });

  router.get("/audit", (req, res) => {
    const projectId = req.query.projectId ? String(req.query.projectId) : undefined;
    res.json({ items: store.listAudits(projectId, Number(req.query.limit ?? 50)) });
  });

  /** Paste a tx hash → full inspector payload */
  router.get("/tx/:hash", async (req, res) => {
    try {
      const inspection = await inspectTransaction(req.params.hash);
      store.audit({
        kind: "tx.inspected",
        mode: "simulation",
        payload: { hash: inspection.hash, status: inspection.status },
        projectId: req.query.projectId ? String(req.query.projectId) : undefined,
      });
      res.json(inspection);
    } catch (e) {
      res.status(502).json({
        error: "RPC inspection failed",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  /** Inspect + create incident + return repair stub */
  router.post("/tx/:hash/debug", async (req, res) => {
    try {
      const projectId = String(req.body?.projectId ?? "");
      const inspection = await inspectTransaction(req.params.hash);
      const repair = proposeRepair(inspection);
      let incident = null;
      if (projectId && store.getProject(projectId)) {
        incident = store.createIncident({
          projectId,
          txHash: inspection.hash,
          chainId: inspection.chainId,
          title:
            inspection.status === "reverted"
              ? `Reverted: ${inspection.revertReason ?? inspection.hash.slice(0, 10)}`
              : `Inspected: ${inspection.hash.slice(0, 10)}…`,
          summary: inspection.summary,
          revertReason: inspection.revertReason ?? undefined,
          proposedPatch: repair.proposedPatch,
          simulation: { gate: repair.simulationGate, mode: repair.mode },
          status: inspection.status === "reverted" ? "open" : "investigating",
        });
      }
      res.json({
        inspection,
        repair,
        incident,
        deepLink: `vane://debug/tx/${inspection.hash}`,
        webLink: `/debug/tx/${inspection.hash}`,
      });
    } catch (e) {
      res.status(502).json({
        error: "Debug pipeline failed",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  /**
   * Telegram-ready alert payload (caller / bot posts it).
   * Never includes private keys — deep link only.
   */
  router.post("/alerts/tx-failure", async (req, res) => {
    const hash = String(req.body?.txHash ?? "");
    const chatId = req.body?.telegramChatId ? String(req.body.telegramChatId) : undefined;
    if (!hash) return res.status(400).json({ error: "txHash required" });
    const inspection = await inspectTransaction(hash);
    const message = [
      "⚠ Vane Debug — transaction issue",
      `Status: ${inspection.status}`,
      `Hash: ${inspection.hash}`,
      inspection.revertReason ? `Revert: ${inspection.revertReason}` : null,
      inspection.summary,
      "",
      `Open in Vane: vane://debug/tx/${inspection.hash}`,
      `Web: ${process.env.APP_URL ?? "http://localhost:3000"}/debug/tx/${inspection.hash}`,
    ]
      .filter(Boolean)
      .join("\n");

    store.audit({
      kind: "telegram.tx_failure_alert",
      mode: "simulation",
      payload: { hash: inspection.hash, chatId: chatId ?? null },
    });

    res.json({
      ok: true,
      chatId: chatId ?? null,
      message,
      buttons: [
        { label: "Review", url: `/debug/tx/${inspection.hash}` },
        { label: "Open in Vane", url: `vane://debug/tx/${inspection.hash}` },
      ],
      note: "Bot delivery uses TELEGRAM_* tokens when configured; this endpoint returns the payload.",
    });
  });

  return router;
}
