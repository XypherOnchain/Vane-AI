import type { ClusterSummary, GraphEdge, HolderRow, ScoreBreakdown } from "@vane/shared";

export type SignalStrength = "strong" | "moderate" | "weak" | "none";

export interface BundleInput {
  tokenAddress: string;
  holders: HolderRow[];
  fundingGroups: Map<string, string[]>; // funder -> wallets
  sameBlockGroups: string[][];
  similarSizePairs: [string, string][];
  historicalCoordinators: string[][];
  commonExitWallets: string[];
}

function strengthFromCount(n: number, strongAt: number, modAt: number): SignalStrength {
  if (n >= strongAt) return "strong";
  if (n >= modAt) return "moderate";
  if (n > 0) return "weak";
  return "none";
}

function strengthScore(s: SignalStrength): number {
  switch (s) {
    case "strong":
      return 1;
    case "moderate":
      return 0.65;
    case "weak":
      return 0.35;
    default:
      return 0;
  }
}

/** Multi-signal bundle / connected-wallet detection — evidence-first */
export function detectClusters(input: BundleInput): ClusterSummary | null {
  const funderEntries = [...input.fundingGroups.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  );
  if (funderEntries.length === 0 && input.sameBlockGroups.length === 0) return null;

  const [funder, funded] = funderEntries[0] ?? ["unknown", [] as string[]];
  const sameBlockOverlap = input.sameBlockGroups.flat().filter((w) => funded.includes(w));
  const wallets = [...new Set([...funded, ...sameBlockOverlap])];
  if (wallets.length < 2) return null;

  const sharedFunding = strengthFromCount(funded.length, 8, 4);
  const sameBlock = strengthFromCount(sameBlockOverlap.length, 6, 3);
  const similarSizing = strengthFromCount(input.similarSizePairs.length, 5, 2);
  const historicalCoordination = strengthFromCount(
    input.historicalCoordinators.flat().filter((w) => wallets.includes(w)).length,
    4,
    2,
  );
  const commonExit =
    input.commonExitWallets.length > 0
      ? ("confirmed" as const)
      : ("none" as const);

  const confidence =
    0.25 * strengthScore(sharedFunding) +
    0.25 * strengthScore(sameBlock) +
    0.15 * strengthScore(similarSizing) +
    0.2 * strengthScore(historicalCoordination) +
    0.15 * (commonExit === "confirmed" ? 1 : 0);

  const holderPct = new Map(input.holders.map((h) => [h.address.toLowerCase(), h.pctSupply]));
  const supplyPct = wallets.reduce((sum, w) => sum + (holderPct.get(w.toLowerCase()) ?? 0), 0);

  return {
    id: `cluster-${input.tokenAddress.slice(2, 10)}-${funder.slice(2, 8)}`,
    confidence: Math.min(0.99, Math.round(confidence * 100) / 100),
    supplyPct: Math.round(supplyPct * 10) / 10,
    walletCount: wallets.length,
    wallets,
    signals: {
      sharedFunding,
      sameBlock,
      similarSizing,
      historicalCoordination,
      commonExit,
    },
  };
}

export function connectedSupplyEstimate(
  holders: HolderRow[],
  cluster: ClusterSummary | null,
): number {
  const top10 = holders.slice(0, 10).reduce((s, h) => s + (h.isLp ? 0 : h.pctSupply), 0);
  if (!cluster) return Math.round(top10 * 10) / 10;
  const visible = new Set(holders.slice(0, 10).map((h) => h.address.toLowerCase()));
  const hidden = cluster.wallets.filter((w) => !visible.has(w.toLowerCase()));
  const hiddenPct = hidden.length * 0.6; // conservative placeholder when balances unknown
  return Math.round(Math.max(top10, cluster.supplyPct, top10 + hiddenPct * 0.1) * 10) / 10;
}

export function scoreToken(input: {
  contract: {
    ownershipRenounced: boolean;
    mintable: boolean;
    freezable: boolean;
    blacklist: boolean;
    upgradeable: boolean;
    liquidityLocked: boolean;
    transferTaxBps: number;
  };
  connectedSupplyPct: number;
  previousLaunchOutcomes: number[];
  liquidityUsd: number;
  buys1h: number;
  sells1h: number;
  freshWalletPct: number;
  holderGrowthRate: number;
  socialVerified: boolean;
}): ScoreBreakdown {
  let contractIntegrity = 20;
  const cEv: string[] = [];
  if (!input.contract.ownershipRenounced) {
    contractIntegrity -= 6;
    cEv.push("Ownership not renounced");
  } else cEv.push("Ownership renounced");
  if (input.contract.mintable) {
    contractIntegrity -= 8;
    cEv.push("Mintable");
  }
  if (input.contract.freezable || input.contract.blacklist) {
    contractIntegrity -= 5;
    cEv.push("Freeze/blacklist present");
  }
  if (input.contract.upgradeable) {
    contractIntegrity -= 4;
    cEv.push("Upgradeable proxy");
  }
  if (input.contract.transferTaxBps > 0) {
    contractIntegrity -= 2;
    cEv.push(`Tax ${input.contract.transferTaxBps / 100}%`);
  }

  let distribution = 20;
  const dEv: string[] = [];
  if (input.connectedSupplyPct > 25) {
    distribution -= 12;
    dEv.push(`Connected supply ${input.connectedSupplyPct}%`);
  } else if (input.connectedSupplyPct > 15) {
    distribution -= 7;
    dEv.push(`Connected supply ${input.connectedSupplyPct}%`);
  } else if (input.connectedSupplyPct > 10) {
    distribution -= 3;
    dEv.push(`Connected supply ${input.connectedSupplyPct}%`);
  } else dEv.push(`Connected supply ${input.connectedSupplyPct}% — acceptable`);

  let developerHistory = 15;
  const dhEv: string[] = [];
  if (input.previousLaunchOutcomes.length === 0) {
    developerHistory -= 3;
    dhEv.push("No prior launches on record");
  } else {
    const avg =
      input.previousLaunchOutcomes.reduce((a, b) => a + b, 0) /
      input.previousLaunchOutcomes.length;
    if (avg < -70) {
      developerHistory -= 10;
      dhEv.push(`Prior launches avg ${avg.toFixed(0)}%`);
    } else if (avg < -40) {
      developerHistory -= 6;
      dhEv.push(`Prior launches avg ${avg.toFixed(0)}%`);
    } else dhEv.push(`Prior launches avg ${avg.toFixed(0)}%`);
  }

  let liquidityQuality = 15;
  const lEv: string[] = [];
  if (input.liquidityUsd < 10_000) {
    liquidityQuality -= 8;
    lEv.push(`Low liquidity $${input.liquidityUsd}`);
  } else if (input.liquidityUsd < 50_000) {
    liquidityQuality -= 4;
    lEv.push(`Liquidity $${input.liquidityUsd}`);
  } else lEv.push(`Liquidity $${input.liquidityUsd}`);
  if (!input.contract.liquidityLocked) {
    liquidityQuality -= 3;
    lEv.push("LP not locked");
  } else lEv.push("LP locked");

  let marketIntegrity = 10;
  const mEv: string[] = [];
  const ratio = input.buys1h / Math.max(1, input.sells1h);
  if (ratio > 3 || ratio < 0.4) {
    marketIntegrity -= 3;
    mEv.push(`Buy/sell skew ${ratio.toFixed(2)}`);
  } else mEv.push(`Buy/sell ratio ${ratio.toFixed(2)}`);

  let walletQuality = 10;
  const wEv: string[] = [];
  if (input.freshWalletPct > 35) {
    walletQuality -= 5;
    wEv.push(`Fresh wallets ${input.freshWalletPct}%`);
  } else if (input.freshWalletPct > 20) {
    walletQuality -= 2;
    wEv.push(`Fresh wallets ${input.freshWalletPct}%`);
  } else wEv.push(`Fresh wallets ${input.freshWalletPct}%`);

  let momentum = 10;
  const moEv: string[] = [];
  if (input.holderGrowthRate > 2) {
    momentum = 9;
    moEv.push("Strong holder growth");
  } else if (input.holderGrowthRate > 0.5) {
    momentum = 7;
    moEv.push("Moderate holder growth");
  } else {
    momentum = 4;
    moEv.push("Weak holder growth");
  }

  const social = input.socialVerified ? 5 : 0;
  const sEv = input.socialVerified
    ? ["Verified community signals"]
    : ["Social signals not yet verified"];

  const clamp = (n: number, max: number) => Math.max(0, Math.min(max, Math.round(n)));

  const breakdown: ScoreBreakdown = {
    total: 0,
    contractIntegrity: clamp(contractIntegrity, 20),
    distribution: clamp(distribution, 20),
    developerHistory: clamp(developerHistory, 15),
    liquidityQuality: clamp(liquidityQuality, 15),
    marketIntegrity: clamp(marketIntegrity, 10),
    walletQuality: clamp(walletQuality, 10),
    momentum: clamp(momentum, 10),
    social: clamp(social, 5),
    evidence: {
      contractIntegrity: cEv,
      distribution: dEv,
      developerHistory: dhEv,
      liquidityQuality: lEv,
      marketIntegrity: mEv,
      walletQuality: wEv,
      momentum: moEv,
      social: sEv,
    },
  };
  breakdown.total =
    breakdown.contractIntegrity +
    breakdown.distribution +
    breakdown.developerHistory +
    breakdown.liquidityQuality +
    breakdown.marketIntegrity +
    breakdown.walletQuality +
    breakdown.momentum +
    breakdown.social;
  return breakdown;
}

export function relationLabelForEdge(
  edge: Pick<GraphEdge, "relation" | "confidence" | "confirmed">,
): string {
  if (edge.confirmed && edge.confidence >= 0.9) return "Confirmed connection";
  switch (edge.relation) {
    case "shared_funding_source":
      return "Shared funding source";
    case "repeated_coordinated_behavior":
      return "Repeated coordinated behavior";
    case "probable_common_controller":
      return "Probable common controller";
    case "potential_relationship":
      return "Potential relationship";
    case "insufficient_evidence":
      return "Insufficient evidence";
    default:
      return "Confirmed connection";
  }
}
