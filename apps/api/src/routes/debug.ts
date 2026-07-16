import { Router } from "express";
import { indexLocalRepo, searchRepoIndex } from "@vane/repo-index";
import { getProjectStore } from "../services/project-store.js";
import { inspectTransaction, proposeRepair } from "../services/tx-inspector.js";
import { runDebugAgent } from "../services/debug-agent.js";

/**
 * Phase 1 — Vane Debug API
 * Workspace / project memory / transaction inspector / repair / tool chat.
 */
export function debugRouter(): Router {
  const router = Router();

  router.get("/meta", async (_req, res) => {
    const store = await getProjectStore();
    res.json({
      backend: store.backend,
      phase: 1,
      liveBroadcast: false,
      modes: ["simulation", "testnet", "live"],
      liveEnabled: false,
    });
  });

  router.get("/projects", async (_req, res) => {
    const store = await getProjectStore();
    res.json({ items: await store.listProjects(), backend: store.backend });
  });

  router.post("/projects", async (req, res) => {
    const store = await getProjectStore();
    const project = await store.createProject({
      name: String(req.body?.name ?? "Untitled project"),
      repoPath: req.body?.repoPath ? String(req.body.repoPath) : undefined,
      githubUrl: req.body?.githubUrl ? String(req.body.githubUrl) : undefined,
      defaultBranch: req.body?.defaultBranch ? String(req.body.defaultBranch) : "main",
      chains: Array.isArray(req.body?.chains) ? req.body.chains.map(Number) : [4663],
      chainConfigs: Array.isArray(req.body?.chainConfigs) ? req.body.chainConfigs : undefined,
      telegramChatId: req.body?.telegramChatId ? String(req.body.telegramChatId) : undefined,
      envVarNames: Array.isArray(req.body?.envVarNames) ? req.body.envVarNames : undefined,
    });
    res.status(201).json(project);
  });

  router.get("/projects/:id", async (req, res) => {
    const store = await getProjectStore();
    const project = await store.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  });

  router.patch("/projects/:id", async (req, res) => {
    const store = await getProjectStore();
    const project = await store.updateProject(req.params.id, {
      name: req.body?.name,
      repoPath: req.body?.repoPath,
      githubUrl: req.body?.githubUrl,
      defaultBranch: req.body?.defaultBranch,
      chains: req.body?.chains,
      chainConfigs: req.body?.chainConfigs,
      telegramChatId: req.body?.telegramChatId,
      envVarNames: req.body?.envVarNames,
    });
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  });

  router.post("/projects/:id/rpc", async (req, res) => {
    const store = await getProjectStore();
    const chainId = Number(req.body?.chainId ?? 4663);
    const rpcUrl = String(req.body?.rpcUrl ?? "");
    if (!rpcUrl.startsWith("http")) {
      return res.status(400).json({ error: "rpcUrl must be http(s)" });
    }
    const project = await store.setChainRpc(req.params.id, chainId, rpcUrl);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  });

  router.post("/projects/:id/wallets", async (req, res) => {
    const store = await getProjectStore();
    const address = String(req.body?.address ?? "");
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: "valid EVM address required" });
    }
    const project = await store.addWallet(req.params.id, {
      address,
      role: (req.body?.role as "watch") ?? "watch",
      label: req.body?.label ? String(req.body.label) : undefined,
      chainId: req.body?.chainId ? Number(req.body.chainId) : 4663,
    });
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.status(201).json(project);
  });

  router.post("/projects/:id/contracts", async (req, res) => {
    const store = await getProjectStore();
    const address = String(req.body?.address ?? "");
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: "valid EVM address required" });
    }
    const project = await store.addContract(req.params.id, {
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

  router.post("/projects/:id/deployments", async (req, res) => {
    const store = await getProjectStore();
    const deployment = await store.addDeployment(req.params.id, {
      chainId: Number(req.body?.chainId ?? 4663),
      contractAddress: String(req.body?.contractAddress ?? ""),
      txHash: req.body?.txHash ? String(req.body.txHash) : undefined,
      label: req.body?.label ? String(req.body.label) : undefined,
    });
    if (!deployment) return res.status(404).json({ error: "Project not found" });
    res.status(201).json(deployment);
  });

  router.post("/projects/:id/env-names", async (req, res) => {
    const store = await getProjectStore();
    const name = String(req.body?.name ?? "").trim();
    if (!name || /secret|key|mnemonic|password/i.test(name) && req.body?.value) {
      // Reject attempts to store values
    }
    if (req.body?.value != null) {
      return res.status(400).json({
        error: "Never send secret values. Only env var names are stored.",
      });
    }
    if (!name) return res.status(400).json({ error: "name required" });
    const project = await store.addEnvVarName(req.params.id, {
      name,
      note: req.body?.note ? String(req.body.note) : undefined,
    });
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.status(201).json(project);
  });

  router.post("/projects/:id/index-repo", async (req, res) => {
    const store = await getProjectStore();
    const project = await store.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const root = String(req.body?.repoPath ?? project.repoPath ?? "");
    if (!root) return res.status(400).json({ error: "repoPath required" });
    const index = indexLocalRepo(root);
    await store.audit({
      projectId: project.id,
      kind: "repo.indexed",
      mode: "simulation",
      payload: { files: index.files.length, abis: index.abis.length },
    });
    res.json({
      root: index.root,
      indexedAt: index.indexedAt,
      fileCount: index.files.length,
      abiCount: index.abis.length,
      sample: index.files.slice(0, 30).map((f) => ({ path: f.path, kind: f.kind })),
    });
  });

  router.get("/projects/:id/search-repo", async (req, res) => {
    const store = await getProjectStore();
    const project = await store.getProject(req.params.id);
    if (!project?.repoPath) return res.status(400).json({ error: "Project has no repoPath" });
    const q = String(req.query.q ?? "");
    const index = indexLocalRepo(project.repoPath);
    res.json({ items: searchRepoIndex(index, q, 30) });
  });

  router.get("/incidents", async (req, res) => {
    const store = await getProjectStore();
    const projectId = req.query.projectId ? String(req.query.projectId) : undefined;
    res.json({ items: await store.listIncidents(projectId) });
  });

  router.get("/incidents/:id", async (req, res) => {
    const store = await getProjectStore();
    const incident = await store.getIncident(req.params.id);
    if (!incident) return res.status(404).json({ error: "Incident not found" });
    res.json(incident);
  });

  router.patch("/incidents/:id", async (req, res) => {
    const store = await getProjectStore();
    const incident = await store.updateIncident(req.params.id, req.body ?? {});
    if (!incident) return res.status(404).json({ error: "Incident not found" });
    res.json(incident);
  });

  router.get("/audit", async (req, res) => {
    const store = await getProjectStore();
    const projectId = req.query.projectId ? String(req.query.projectId) : undefined;
    res.json({ items: await store.listAudits(projectId, Number(req.query.limit ?? 50)) });
  });

  router.get("/tx/:hash", async (req, res) => {
    try {
      const store = await getProjectStore();
      const projectId = req.query.projectId ? String(req.query.projectId) : undefined;
      const project = projectId ? await store.getProject(projectId) : null;
      const inspection = await inspectTransaction(req.params.hash, { project });
      await store.audit({
        kind: "tx.inspected",
        mode: "simulation",
        payload: { hash: inspection.hash, status: inspection.status },
        projectId,
      });
      res.json(inspection);
    } catch (e) {
      res.status(502).json({
        error: "RPC inspection failed",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  router.post("/tx/:hash/debug", async (req, res) => {
    try {
      const store = await getProjectStore();
      const projectId = String(req.body?.projectId ?? "");
      const project = projectId ? await store.getProject(projectId) : null;
      const inspection = await inspectTransaction(req.params.hash, { project });
      const repair = await proposeRepair(inspection, project);
      let incident = null;
      if (project) {
        incident = await store.createIncident({
          projectId: project.id,
          txHash: inspection.hash,
          chainId: inspection.chainId,
          title:
            inspection.status === "reverted"
              ? `Reverted: ${inspection.revertReason ?? inspection.hash.slice(0, 10)}`
              : `Inspected: ${inspection.hash.slice(0, 10)}…`,
          summary: inspection.summary,
          revertReason: inspection.revertReason ?? undefined,
          relatedCode: inspection.relatedCode.map((c) => ({
            path: c.path,
            lines: String(c.line),
            note: c.functionName,
            selector: c.selector,
          })),
          proposedPatch: repair.proposedPatch,
          testSketch: repair.testSketch,
          simulation: {
            gate: repair.simulationGate,
            mode: repair.mode,
            result: repair.simulation,
          },
          status: inspection.status === "reverted" ? "open" : "investigating",
        });
      }
      res.json({
        inspection,
        repair,
        incident,
        deepLink: `vane://debug/tx/${inspection.hash}`,
        webLink: `/debug/tx/${inspection.hash}`,
        modes: { simulation: true, testnet: true, live: false },
      });
    } catch (e) {
      res.status(502).json({
        error: "Debug pipeline failed",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  router.post("/tx/:hash/repair", async (req, res) => {
    try {
      const store = await getProjectStore();
      const projectId = req.body?.projectId ? String(req.body.projectId) : undefined;
      const project = projectId ? await store.getProject(projectId) : null;
      const inspection = await inspectTransaction(req.params.hash, { project });
      const repair = await proposeRepair(inspection, project);
      res.json({ inspection, repair, liveEnabled: false });
    } catch (e) {
      res.status(502).json({
        error: "Repair failed",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  router.post("/chat", async (req, res) => {
    const store = await getProjectStore();
    const question = String(req.body?.question ?? req.body?.message ?? "");
    if (!question.trim()) return res.status(400).json({ error: "question required" });
    const answer = await runDebugAgent(question, {
      store,
      projectId: req.body?.projectId ? String(req.body.projectId) : undefined,
      webUrl: process.env.APP_URL ?? "http://localhost:3000",
    });
    res.json(answer);
  });

  /**
   * Telegram-ready alert — posts when TELEGRAM_DEBUG_BOT_TOKEN is set.
   */
  router.post("/alerts/tx-failure", async (req, res) => {
    const store = await getProjectStore();
    const hash = String(req.body?.txHash ?? "");
    const chatId = req.body?.telegramChatId ? String(req.body.telegramChatId) : undefined;
    if (!hash) return res.status(400).json({ error: "txHash required" });
    const projectId = req.body?.projectId ? String(req.body.projectId) : undefined;
    const project = projectId ? await store.getProject(projectId) : null;
    const inspection = await inspectTransaction(hash, { project });
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const message = [
      "⚠ Vane Debug — transaction issue",
      `Status: ${inspection.status}`,
      `Hash: ${inspection.hash}`,
      inspection.functionName ? `Function: ${inspection.functionName}` : null,
      inspection.revertReason ? `Revert: ${inspection.revertReason}` : null,
      inspection.summary,
      "",
      `Open in Vane: vane://debug/tx/${inspection.hash}`,
      `Web: ${appUrl}/debug/tx/${inspection.hash}`,
    ]
      .filter(Boolean)
      .join("\n");

    let delivered = false;
    let deliveryError: string | undefined;
    const token = process.env.TELEGRAM_DEBUG_BOT_TOKEN || process.env.TELEGRAM_INTELLIGENCE_BOT_TOKEN;
    const targetChat = chatId || project?.telegramChatId;
    if (token && targetChat) {
      try {
        const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: targetChat,
            text: message,
            disable_web_page_preview: true,
          }),
        });
        delivered = tg.ok;
        if (!tg.ok) deliveryError = await tg.text();
      } catch (e) {
        deliveryError = e instanceof Error ? e.message : String(e);
      }
    }

    await store.audit({
      kind: "telegram.tx_failure_alert",
      mode: "simulation",
      payload: {
        hash: inspection.hash,
        chatId: targetChat ?? null,
        delivered,
      },
    });

    res.json({
      ok: true,
      chatId: targetChat ?? null,
      message,
      delivered,
      deliveryError,
      buttons: [
        { label: "Review", url: `${appUrl}/debug/tx/${inspection.hash}` },
        { label: "Open in Vane", url: `vane://debug/tx/${inspection.hash}` },
      ],
      note: "Signing from chat is never accepted for meaningful value.",
    });
  });

  return router;
}
