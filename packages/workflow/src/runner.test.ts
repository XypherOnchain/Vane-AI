import { describe, expect, it } from "vitest";
import { parseWorkflowNl, runWorkflow } from "./runner.js";

describe("workflow runner", () => {
  it("parses NL into trigger→…→audit graph and stops at sign", () => {
    const g = parseWorkflowNl("Bridge 1 ETH to treasury after simulate");
    expect(g.nodes.map((n) => n.kind)).toEqual([
      "trigger",
      "simulate",
      "policy",
      "sign",
      "broadcast",
      "confirm",
      "audit",
    ]);
    const run = runWorkflow(g.id);
    expect(run.status).toBe("awaiting_approval");
    expect(run.requiresExternalSign).toBe(true);
  });
});
