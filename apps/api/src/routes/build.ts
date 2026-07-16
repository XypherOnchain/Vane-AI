import { Router } from "express";
import { indexLocalRepo, searchRepoIndex } from "@vane/repo-index";
import { getProjectStore } from "../services/project-store.js";

/**
 * Phase 2 — Vane Build (ABI-aware repo intelligence + deploy assist stubs).
 */
export function buildRouter(): Router {
  const router = Router();

  router.get("/entitlements", (_req, res) => {
    res.json({
      plan: "developer",
      features: {
        debug: true,
        build: true,
        flow: true,
        operate: true,
        agent: true,
        aiCredits: 500,
        simulations: 100,
      },
      billing: "stub — integrate when Developer plan is demoable",
    });
  });

  router.post("/templates/:protocol", (req, res) => {
    const protocol = req.params.protocol;
    const templates: Record<string, unknown> = {
      uniswap: {
        name: "Uniswap V3 swap stub",
        files: ["contracts/SwapRouter.sol", "scripts/deploy.ts"],
        note: "Template only — review before fork sim",
      },
      across: {
        name: "Across bridge stub",
        files: ["contracts/AcrossSpoke.sol"],
        note: "Confirm destination role in project memory",
      },
    };
    const t = templates[protocol];
    if (!t) return res.status(404).json({ error: "unknown protocol template" });
    res.json(t);
  });

  router.post("/secret-scan", async (req, res) => {
    const store = await getProjectStore();
    const projectId = String(req.body?.projectId ?? "");
    const project = projectId ? await store.getProject(projectId) : null;
    if (!project?.repoPath) return res.status(400).json({ error: "project with repoPath required" });
    const index = indexLocalRepo(project.repoPath);
    const findings = index.files
      .filter((f) => /\.env|secret|key/i.test(f.path))
      .map((f) => ({ path: f.path, severity: "high" as const, text: "Possible secrets file — do not commit" }));
    res.json({ findings, scanned: index.files.length });
  });

  router.post("/deploy-manifest", async (req, res) => {
    const name = String(req.body?.name ?? "Contract");
    res.json({
      name,
      chains: req.body?.chains ?? [4663],
      simulateBeforeLive: true,
      liveEnabled: false,
      ownershipDiffRequired: true,
      note: "Prepare-only. External signing in Phase 3.",
    });
  });

  router.get("/search", async (req, res) => {
    const store = await getProjectStore();
    const projectId = String(req.query.projectId ?? "");
    const q = String(req.query.q ?? "");
    const project = await store.getProject(projectId);
    if (!project?.repoPath) return res.status(400).json({ error: "repoPath required" });
    const index = indexLocalRepo(project.repoPath);
    res.json({ items: searchRepoIndex(index, q) });
  });

  return router;
}
