import { describe, expect, it, vi } from "vitest";
import { DEMO_TOKEN } from "../data/demo.js";

async function loadStore(demoMode: boolean) {
  vi.resetModules();
  process.env.NODE_ENV = "test";
  process.env.VANE_DEMO_MODE = demoMode ? "true" : "false";
  delete process.env.REDIS_URL;
  const config = await import("@vane/config");
  config.resetEnvCache();
  const store = await import("./store.js");
  // demo seeding is an async dynamic import; give it a tick to complete
  await new Promise((r) => setTimeout(r, 25));
  return store;
}

describe("store with VANE_DEMO_MODE disabled (default)", () => {
  it("returns no token intelligence", async () => {
    const store = await loadStore(false);
    expect(store.demoMode).toBe(false);
    expect(store.getToken(DEMO_TOKEN)).toBeNull();
    expect(await store.getTokenCached(DEMO_TOKEN)).toBeNull();
  });

  it("returns an empty radar instead of simulated pairs", async () => {
    const store = await loadStore(false);
    expect(store.listRadar()).toEqual([]);
    expect(store.listNewPairs()).toEqual([]);
    expect(store.listTrending()).toEqual([]);
  });

  it("returns no wallet or graph intelligence", async () => {
    const store = await loadStore(false);
    expect(store.getWallet("0x1111111111111111111111111111111111111111")).toBeNull();
    expect(store.getGraph(DEMO_TOKEN)).toBeNull();
  });

  it("never fires simulated alerts", async () => {
    const store = await loadStore(false);
    store.createAlert({ kind: "cluster_sell", tokenAddress: DEMO_TOKEN });
    expect(store.evaluateAlerts()).toEqual([]);
  });

  it("cannot create a report from demo data", async () => {
    const store = await loadStore(false);
    expect(store.createReport(DEMO_TOKEN)).toBeNull();
  });
});

describe("store with VANE_DEMO_MODE deliberately enabled", () => {
  it("serves demo data marked as demo", async () => {
    const store = await loadStore(true);
    expect(store.demoMode).toBe(true);
    const token = store.getToken(DEMO_TOKEN);
    expect(token).not.toBeNull();
    expect(token!.dataSource).toBe("demo");
  });

  it("marks every radar card as demo", async () => {
    const store = await loadStore(true);
    const items = store.listRadar();
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(item.dataSource).toBe("demo");
  });

  it("prefixes fired demo alerts with [DEMO]", async () => {
    const store = await loadStore(true);
    store.createAlert({ kind: "cluster_sell", tokenAddress: DEMO_TOKEN });
    const fired = store.evaluateAlerts();
    for (const f of fired) expect(f.message.startsWith("[DEMO]")).toBe(true);
  });
});
