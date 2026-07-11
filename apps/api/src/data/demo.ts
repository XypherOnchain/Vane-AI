import type {
  ClusterSummary,
  IntegrityScore,
  MomentumScore,
  DataConfidence,
  HolderRow,
  RadarCard,
  ScanFinding,
  TokenOverview,
  WalletDna,
  GraphEdge,
  GraphNode,
} from "@vane/shared-types";

export const DEMO_TOKEN = "0x8a2e897abb6bf1d77c61cb3fa6c093ac71dc0efd";

function addr(n: number): string {
  return `0x${n.toString(16).padStart(40, "0")}`;
}

const deployer = addr(0xa1);
const funder = addr(0xb2);
const clusterWallets = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(addr);

export function buildIntegrity(): IntegrityScore {
  return {
    total: 63,
    contractSafety: 18,
    distributionQuality: 10,
    liquidityQuality: 14,
    developerHistory: 10,
    marketIntegrity: 11,
    version: "integrity.v1",
    evidence: {
      contractSafety: ["Ownership renounced", "No mint detected", "Transfer tax 0%"],
      distributionQuality: ["Top-10 visible (ex-LP): 18.2%", "Probable connected cluster: 26.7%"],
      liquidityQuality: ["Liquidity $12.1K", "LP unlocked — removal risk"],
      developerHistory: ["2 prior launches", "One prior launch −94% after coordinated sell"],
      marketIntegrity: ["Buy/sell skew elevated", "Repeated wallet participation moderate"],
    },
  };
}

export function buildMomentum(): MomentumScore {
  return {
    total: 78,
    version: "momentum.v1",
    evidence: ["+3K% 1h move", "261 holders in 48m", "Unique buyers accelerating"],
  };
}

export function buildConfidence(): DataConfidence {
  return {
    level: "medium",
    score: 72,
    reasons: ["Market data ready", "Graph indexed", "Contract source unverified"],
  };
}

export function buildCluster(): ClusterSummary {
  return {
    id: "cluster-demo-1",
    confidence: 0.87,
    classification: "shared_funding",
    supplyPct: 26.7,
    confirmedSupplyPct: 8.2,
    probableSupplyPct: 26.7,
    walletCount: 14,
    wallets: clusterWallets,
    signals: {
      sharedFunding: "strong",
      sameBlock: "strong",
      similarSizing: "moderate",
      historicalCoordination: "strong",
      commonExit: "confirmed",
    },
    evidenceIds: ["ev-fund-1", "ev-block-1", "ev-exit-1"],
  };
}

export function buildHolders(): HolderRow[] {
  return [
    { address: addr(0xc0), pctSupply: 24.4, balance: "244000000", isLp: true, label: "LP" },
    {
      address: clusterWallets[0]!,
      pctSupply: 2.0,
      balance: "20000000",
      clusterId: "cluster-demo-1",
    },
    {
      address: clusterWallets[1]!,
      pctSupply: 2.0,
      balance: "20000000",
      clusterId: "cluster-demo-1",
    },
    {
      address: clusterWallets[2]!,
      pctSupply: 2.0,
      balance: "20000000",
      clusterId: "cluster-demo-1",
    },
    {
      address: clusterWallets[3]!,
      pctSupply: 2.0,
      balance: "20000000",
      clusterId: "cluster-demo-1",
    },
    { address: addr(0xd1), pctSupply: 1.8, balance: "18000000" },
    { address: addr(0xd2), pctSupply: 1.5, balance: "15000000" },
    { address: deployer, pctSupply: 1.2, balance: "12000000", label: "Deployer" },
    { address: addr(0xd3), pctSupply: 1.1, balance: "11000000" },
    { address: addr(0xd4), pctSupply: 1.0, balance: "10000000" },
  ];
}

export function buildFindings(token: string): ScanFinding[] {
  return [
    {
      id: "f1",
      tokenAddress: token,
      ruleId: "ownership.renounced",
      ruleVersion: "1.0.0",
      severity: "info",
      title: "Ownership renounced",
      summary: "Owner() returns the zero address.",
      technicalDetails: "owner() == address(0)",
      confidence: 0.99,
      status: "confirmed",
      evidenceIds: ["ev-owner-1"],
      createdAt: new Date().toISOString(),
    },
    {
      id: "f2",
      tokenAddress: token,
      ruleId: "liquidity.unlocked",
      ruleVersion: "1.0.0",
      severity: "medium",
      title: "LP unlocked",
      summary: "Primary LP tokens are not locked or burned.",
      technicalDetails: "LP holder is an EOA with transfer capability",
      confidence: 0.9,
      status: "confirmed",
      evidenceIds: ["ev-lp-1"],
      createdAt: new Date().toISOString(),
    },
    {
      id: "f3",
      tokenAddress: token,
      ruleId: "distribution.cluster",
      ruleVersion: "1.0.0",
      severity: "high",
      title: "Probable connected supply",
      summary: "14 wallets share a funding source and early coordinated buys.",
      technicalDetails: "shared_funding + same_block + historical_coordination",
      confidence: 0.87,
      status: "probable",
      evidenceIds: ["ev-fund-1", "ev-block-1"],
      createdAt: new Date().toISOString(),
    },
  ];
}

export function buildTokenOverview(address?: string): TokenOverview {
  const a = (address ?? DEMO_TOKEN).toLowerCase();
  const cluster = buildCluster();
  return {
    address: a,
    chainId: 4663,
    name: "RobinhoodTrumpGMEShr",
    symbol: "NASDAQ",
    decimals: 18,
    priceUsd: 0.00007533,
    marketCapUsd: 75_300,
    fdvUsd: 75_300,
    liquidityUsd: 12_100,
    volume1hUsd: 185_000,
    volume24hUsd: 410_000,
    buys1h: 1100,
    sells1h: 781,
    holders: 261,
    uniqueBuyers: 198,
    ageMinutes: 48,
    athFdvUsd: 169_000,
    athMinutesAgo: 33,
    deployer,
    deployerFunding: funder,
    launchpad: "Noxa",
    processingState: "GRAPH_READY",
    topHolders: buildHolders(),
    connectedSupplyPct: 26.7,
    confirmedConnectedSupplyPct: 8.2,
    probableConnectedSupplyPct: 26.7,
    freshWalletPct: 19,
    integrity: buildIntegrity(),
    momentum: buildMomentum(),
    dataConfidence: buildConfidence(),
    cluster,
    findings: buildFindings(a),
    summary:
      "Vane detected elevated distribution risk. Fourteen wallets with a shared funding source collectively control 26.7% of supply. The contract itself contains no critical transfer restrictions, and liquidity has remained thin relative to volume during the last hour.",
    summaryEvidenceIds: ["ev-fund-1", "ev-owner-1", "ev-lp-1"],
    warnings: [
      {
        text: "Probable connected wallets control 26.7% of supply.",
        href: `/graph/${a}`,
        severity: "high",
      },
    ],
  };
}

export function buildGraph(_tokenAddress: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const holders = buildHolders();
  const nodes: GraphNode[] = [
    { id: deployer, address: deployer, size: 40, category: "deployer", label: "Deployer" },
    { id: funder, address: funder, size: 50, category: "deployer_linked", label: "Shared funder" },
    ...holders.map((h) => ({
      id: h.address,
      address: h.address,
      size: Math.max(12, h.pctSupply * 4),
      category: (h.isLp
        ? "liquidity_pool"
        : h.clusterId
          ? "probable_cluster"
          : "unclassified") as GraphNode["category"],
      label: h.label,
      clusterId: h.clusterId,
    })),
  ];
  const edges: GraphEdge[] = [
    {
      id: "e1",
      from: funder,
      to: deployer,
      relation: "funded",
      confidence: 0.99,
      confirmed: true,
      why: "Direct ETH funding before deployment",
      evidenceIds: ["ev-fund-deployer"],
      txHashes: [`0x${"ab".repeat(32)}`],
    },
    ...clusterWallets.slice(0, 8).map((w, i) => ({
      id: `ef-${i}`,
      from: funder,
      to: w,
      relation: "shared_funder",
      confidence: 0.91,
      confirmed: true,
      why: "Funded from same source within 3 minutes of launch",
      evidenceIds: ["ev-fund-1"],
    })),
  ];
  return { nodes, edges };
}

export function buildWallet(address: string): WalletDna {
  return {
    address: address.toLowerCase(),
    dnaClass: "Early Launch Trader",
    walletAgeDays: 217,
    fundingOrigin: funder,
    winRate: 0.62,
    realizedPnlUsd: 48_200,
    unrealizedPnlUsd: 2_100,
    medianEntryMinutes: 12,
    medianPositionEth: 0.42,
    medianHoldMinutes: 51,
    completedWins: 18,
    completedTotal: 29,
    associatedClusterSize: 4,
    recentBehaviorNote: "Position sizes have increased 220% over the last seven days",
  };
}

export function buildRadar(): RadarCard[] {
  const base = buildTokenOverview();
  return [
    {
      address: base.address,
      name: base.name,
      symbol: base.symbol,
      marketCapUsd: base.marketCapUsd,
      liquidityUsd: base.liquidityUsd,
      volume1hUsd: base.volume1hUsd,
      buys1h: base.buys1h,
      sells1h: base.sells1h,
      uniqueBuyers: base.uniqueBuyers,
      holders: base.holders,
      ageMinutes: base.ageMinutes,
      connectedSupplyPct: base.probableConnectedSupplyPct,
      integrityScore: base.integrity.total,
      momentumScore: base.momentum.total,
      launchpad: base.launchpad,
      status: "Live",
      processingState: base.processingState,
      alerts: ["Cluster transferring", "Elevated connected supply"],
      developerStatus: "holding",
      dataReady: { market: true, holders: true, contract: true, graph: true },
    },
    {
      address: addr(0xf1),
      name: "Hooded Pengu",
      symbol: "HOODP",
      marketCapUsd: 210_000,
      liquidityUsd: 42_000,
      volume1hUsd: 890_000,
      buys1h: 420,
      sells1h: 310,
      uniqueBuyers: 180,
      holders: 512,
      ageMinutes: 180,
      connectedSupplyPct: 9.4,
      integrityScore: 71,
      momentumScore: 64,
      launchpad: "Noxa",
      status: "Graduating",
      processingState: "PUBLISHED",
      alerts: [],
      developerStatus: "holding",
      dataReady: { market: true, holders: true, contract: true, graph: true },
    },
    {
      address: addr(0xf2),
      name: "Chainley",
      symbol: "RICK",
      marketCapUsd: 55_000,
      liquidityUsd: 18_000,
      volume1hUsd: 120_000,
      buys1h: 90,
      sells1h: 70,
      uniqueBuyers: 64,
      holders: 140,
      ageMinutes: 25,
      connectedSupplyPct: 31.2,
      integrityScore: 41,
      momentumScore: 55,
      launchpad: "Noxa",
      status: "New",
      processingState: "SCAN_READY",
      alerts: ["High connected supply"],
      developerStatus: "selling",
      dataReady: { market: true, holders: true, contract: false, graph: false },
    },
    {
      address: addr(0xf3),
      name: "Virtuals Gate",
      symbol: "VGATE",
      marketCapUsd: 340_000,
      liquidityUsd: 95_000,
      volume1hUsd: 1_200_000,
      buys1h: 800,
      sells1h: 620,
      uniqueBuyers: 410,
      holders: 1200,
      ageMinutes: 720,
      connectedSupplyPct: 11.0,
      integrityScore: 68,
      momentumScore: 81,
      launchpad: "Virtuals",
      status: "Graduated",
      processingState: "PUBLISHED",
      alerts: ["Smart wallets entering"],
      developerStatus: "holding",
      dataReady: { market: true, holders: true, contract: true, graph: true },
    },
  ];
}
