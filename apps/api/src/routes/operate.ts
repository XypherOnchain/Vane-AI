import { Router } from "express";
import { DEFAULT_POLICY } from "@vane/policy";
import { getProjectStore } from "../services/project-store.js";

/**
 * Phase 4 — Vane Operate (treasury inventory, monitoring, policies, vault note).
 */
export function operateRouter(): Router {
  const router = Router();

  router.get("/dashboard/:projectId", async (req, res) => {
    const store = await getProjectStore();
    const project = await store.getProject(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json({
      projectId: project.id,
      name: project.name,
      chains: project.chainConfigs,
      wallets: project.wallets.map((w) => ({
        ...w,
        custody: "watch_only",
      })),
      contracts: project.contracts,
      deployments: project.deployments,
      risks: project.contracts
        .filter((c) => c.isProduction)
        .map((c) => ({
          address: c.address,
          text: "Production contract — monitor ownership / pause / approvals",
        })),
      vault: {
        level: 3,
        location: "desktop_only",
        note: "Local encrypted vault keys never leave the desktop (Phase 4.4).",
      },
    });
  });

  router.get("/policy", (_req, res) => {
    res.json({ rules: DEFAULT_POLICY, teamRoles: ["owner", "operator", "viewer"] });
  });

  router.get("/audit/:projectId", async (req, res) => {
    const store = await getProjectStore();
    res.json({ items: await store.listAudits(req.params.projectId, 100) });
  });

  router.get("/integrations", (_req, res) => {
    res.json({
      safe: { status: "planned", note: "Safe multi-sig integration Phase 4.5" },
      hardware: { status: "planned", note: "Ledger/Trezor via WalletConnect" },
      walletConnect: { status: "ready_for_flow", note: "External signing Phase 3" },
    });
  });

  return router;
}
