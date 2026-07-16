import { describe, expect, it } from "vitest";
import { canRunAgentJob, DEFAULT_POLICY, evaluatePolicy } from "./engine.js";

describe("policy engine", () => {
  it("blocks chat signing and over-limit value", () => {
    const d = evaluatePolicy(DEFAULT_POLICY, {
      kind: "rebalance",
      nativeValueEth: 1,
      chatSign: true,
    });
    expect(d.allow).toBe(false);
    expect(d.requireHuman).toBe(true);
  });

  it("allows small gas top-up within limits", () => {
    const d = canRunAgentJob(DEFAULT_POLICY, "gas_topup", { nativeValueEth: 0.01 });
    expect(d.allow).toBe(true);
  });
});
