/**
 * Hard policy constraints (Phase 4/5).
 * High-value irreversible actions always require a human.
 */

export type AgentJobKind = "claim" | "gas_topup" | "rebalance" | "incident_triage" | "custom";

export interface PolicyRules {
  maxNativeValueEth: number;
  allowUnlimitedApprovals: boolean;
  allowLiveBroadcast: boolean;
  allowChatSigning: boolean;
  allowedJobKinds: AgentJobKind[];
  requireHumanFor: AgentJobKind[];
  productionContractsRequireSimulation: boolean;
}

export interface PolicyDecision {
  allow: boolean;
  reasons: string[];
  requireHuman: boolean;
}

export const DEFAULT_POLICY: PolicyRules = {
  maxNativeValueEth: 0.05,
  allowUnlimitedApprovals: false,
  allowLiveBroadcast: false,
  allowChatSigning: false,
  allowedJobKinds: ["claim", "gas_topup", "incident_triage"],
  requireHumanFor: ["rebalance", "custom"],
  productionContractsRequireSimulation: true,
};

export function evaluatePolicy(
  rules: PolicyRules,
  action: {
    kind: AgentJobKind;
    nativeValueEth?: number;
    unlimitedApproval?: boolean;
    live?: boolean;
    chatSign?: boolean;
    productionTarget?: boolean;
    simulated?: boolean;
  },
): PolicyDecision {
  const reasons: string[] = [];
  let allow = true;
  let requireHuman = rules.requireHumanFor.includes(action.kind);

  if (!rules.allowedJobKinds.includes(action.kind) && action.kind !== "incident_triage") {
    allow = false;
    reasons.push(`Job kind "${action.kind}" not in allowlist`);
    requireHuman = true;
  }
  if ((action.nativeValueEth ?? 0) > rules.maxNativeValueEth) {
    allow = false;
    reasons.push(`Native value exceeds ${rules.maxNativeValueEth} ETH limit`);
    requireHuman = true;
  }
  if (action.unlimitedApproval && !rules.allowUnlimitedApprovals) {
    allow = false;
    reasons.push("Unlimited approvals blocked by policy");
    requireHuman = true;
  }
  if (action.live && !rules.allowLiveBroadcast) {
    allow = false;
    reasons.push("Live broadcast disabled by policy");
  }
  if (action.chatSign && !rules.allowChatSigning) {
    allow = false;
    reasons.push("Chat-as-signature never allowed for meaningful value");
    requireHuman = true;
  }
  if (action.productionTarget && rules.productionContractsRequireSimulation && !action.simulated) {
    allow = false;
    reasons.push("Production target requires successful fork simulation first");
  }
  if (allow && reasons.length === 0) {
    reasons.push("Within policy limits");
  }
  return { allow, reasons, requireHuman };
}

export function canRunAgentJob(
  rules: PolicyRules,
  kind: AgentJobKind,
  opts?: { nativeValueEth?: number; humanApproved?: boolean },
): PolicyDecision {
  const decision = evaluatePolicy(rules, {
    kind,
    nativeValueEth: opts?.nativeValueEth,
    live: false,
    chatSign: false,
  });
  if (decision.requireHuman && !opts?.humanApproved) {
    return {
      allow: false,
      reasons: [...decision.reasons, "Human approval required for irreversible / high-value step"],
      requireHuman: true,
    };
  }
  return decision;
}
