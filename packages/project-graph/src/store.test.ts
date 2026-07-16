import { describe, expect, it } from "vitest";
import { ProjectGraphStore } from "./store.js";

describe("ProjectGraphStore", () => {
  it("creates a project with Robinhood Chain default and records audit", () => {
    const store = new ProjectGraphStore();
    const p = store.createProject({ name: "Treasury Automation" });
    expect(p.chains).toEqual([4663]);
    expect(p.chainConfigs.some((c) => c.chainId === 4663)).toBe(true);
    expect(store.listProjects()).toHaveLength(1);
    expect(store.listAudits(p.id)[0]?.kind).toBe("project.created");
  });

  it("tracks wallets by role and incidents by tx", () => {
    const store = new ProjectGraphStore();
    const p = store.createProject({ name: "Bot" });
    store.addWallet(p.id, {
      address: "0x58e4B4596AF90aF419122dAD34657eF915D1237d",
      role: "operator",
      label: "Sniper",
    });
    const incident = store.createIncident({
      projectId: p.id,
      txHash: `0x${"ab".repeat(32)}`,
      chainId: 4663,
      title: "Swap reverted",
      revertReason: "STF",
    });
    expect(store.getProject(p.id)?.wallets[0]?.role).toBe("operator");
    expect(store.listIncidents(p.id)[0]?.id).toBe(incident.id);
  });
});
