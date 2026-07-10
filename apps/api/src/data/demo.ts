import type {
  ClusterSummary,
  ContractIntel,
  GraphEdge,
  GraphNode,
  HolderRow,
  PreviousLaunch,
  RadarCard,
  ScoreBreakdown,
  TokenScan,
  WalletDna,
} from "@vane/shared";

/** Canonical demo CA for UI/bot polish (Rick-style trench token) */
export const DEMO_NASDAQ = "0x8a2e897abb6bf1d77c61cb3fa6c093ac71dc0efd2d";

function addr(n: number): string {
  return `0x${n.toString(16).padStart(40, "0")}`;
}

const deployer = addr(0xa1);
const funder = addr(0xb2);
const clusterWallets = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(addr);

export function buildDemoScore(): ScoreBreakdown {
  return {
    total: 63,
    contractIntegrity: 18,
    distribution: 7,
    developerHistory: 8,
    liquidityQuality: 12,
    marketIntegrity: 6,
    walletQuality: 5,
    momentum: 7,
    social: 0,
    evidence: {
      contractIntegrity: ["Ownership renounced", "No mint function detected", "Transfer tax 0%"],
      distribution: [
        "Top 10 visible holders: 18.2%",
        "Probable connected cluster: +8.5% → 26.7% combined",
      ],
      developerHistory: [
        "Deployer funded by shared source",
        "2 previous launches; one -94% after coordinated sell",
      ],
      liquidityQuality: ["Liquidity $12.1K", "LP not locked — elevated removal risk"],
      marketIntegrity: ["Buy/sell ratio elevated", "Repeated wallet participation moderate"],
      walletQuality: ["19% fresh wallets", "Avg wallet age 31 weeks"],
      momentum: ["+3K% 1h", "261 holders in 48m", "Unique buyers accelerating"],
      social: ["Social signals not yet verified"],
    },
  };
}

export function buildDemoCluster(): ClusterSummary {
  return {
    id: "cluster-demo-1",
    confidence: 0.87,
    supplyPct: 26.7,
    walletCount: 14,
    wallets: clusterWallets,
    signals: {
      sharedFunding: "strong",
      sameBlock: "strong",
      similarSizing: "moderate",
      historicalCoordination: "strong",
      commonExit: "confirmed",
    },
  };
}

export function buildDemoHolders(): HolderRow[] {
  return [
    { address: addr(0xc0), pctSupply: 24.4, balance: "244000000", isLp: true },
    { address: clusterWallets[0], pctSupply: 2.0, balance: "20000000", clusterId: "cluster-demo-1" },
    { address: clusterWallets[1], pctSupply: 2.0, balance: "20000000", clusterId: "cluster-demo-1" },
    { address: clusterWallets[2], pctSupply: 2.0, balance: "20000000", clusterId: "cluster-demo-1" },
    { address: clusterWallets[3], pctSupply: 2.0, balance: "20000000", clusterId: "cluster-demo-1" },
    { address: addr(0xd1), pctSupply: 1.8, balance: "18000000" },
    { address: addr(0xd2), pctSupply: 1.5, balance: "15000000" },
    { address: deployer, pctSupply: 1.2, balance: "12000000" },
    { address: addr(0xd3), pctSupply: 1.1, balance: "11000000" },
    { address: addr(0xd4), pctSupply: 1.0, balance: "10000000" },
  ];
}

export function buildDemoContract(): ContractIntel {
  return {
    verified: false,
    ownershipRenounced: true,
    upgradeable: false,
    mintable: false,
    freezable: false,
    blacklist: false,
    transferTaxBps: 0,
    maxTxPct: null,
    liquidityLocked: false,
  };
}

export function buildDemoLaunches(): PreviousLaunch[] {
  return [
    {
      address: addr(0xe1),
      symbol: "HOODP",
      athFdvUsd: 420_000,
      outcomePct: -94,
      launchedAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    },
    {
      address: addr(0xe2),
      symbol: "RHT",
      athFdvUsd: 88_000,
      outcomePct: -61,
      launchedAt: new Date(Date.now() - 28 * 86400000).toISOString(),
    },
  ];
}

export function buildDemoTokenScan(address?: string): TokenScan {
  const a = (address ?? DEMO_NASDAQ).toLowerCase();
  const score = buildDemoScore();
  const cluster = buildDemoCluster();
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
    volumeUsd: 185_000,
    buys1h: 1100,
    sells1h: 781,
    holders: 261,
    uniqueBuyers: 198,
    ageMinutes: 48,
    athFdvUsd: 169_000,
    athMinutesAgo: 33,
    deployer,
    deployerFunding: funder,
    previousLaunches: buildDemoLaunches(),
    topHolders: buildDemoHolders(),
    connectedSupplyPct: 26.7,
    freshWalletPct: 19,
    securityTags: ["MAE", "GMG", "BSD", "BBW", "BLO", "EXP", "TW"],
    contract: buildDemoContract(),
    vaneScore: score,
    cluster,
    summary:
      "This token has elevated distribution risk. The publicly visible top 10 holders control 18.2% of supply. However, Vane identified 14 additional wallets that were funded by the same source and purchased during the first four blocks. Together, this probable cluster controls 26.7% of supply. The funding wallet also interacted with two previous token deployers. One previous launch lost 94% of its value after cluster wallets sold within the same 12-minute period. Current activity: Three wallets in the cluster began transferring tokens six minutes ago.",
    indexing: false,
  };
}

export function buildDemoGraph(tokenAddress: string): {
  nodes: GraphNode[];
  edges: GraphEdge[];
} {
  const holders = buildDemoHolders();
  const nodes: GraphNode[] = [
    {
      id: deployer,
      address: deployer,
      size: 40,
      label: "Deployer",
      isDeployer: true,
    },
    {
      id: funder,
      address: funder,
      size: 50,
      label: "Shared funder",
    },
    ...holders.map((h, i) => ({
      id: h.address,
      address: h.address,
      size: Math.max(12, h.pctSupply * 4),
      label: h.isLp ? "LP" : undefined,
      clusterId: h.clusterId,
    })),
  ];

  const edges: GraphEdge[] = [
    {
      id: "e1",
      from: funder,
      to: deployer,
      relation: "confirmed_connection",
      confidence: 0.99,
      confirmed: true,
      why: "Direct ETH funding before deployment",
      when: new Date(Date.now() - 50 * 60000).toISOString(),
      txHashes: [`0x${"ab".repeat(32)}`],
    },
    ...clusterWallets.slice(0, 8).map((w, i) => ({
      id: `ef-${i}`,
      from: funder,
      to: w,
      relation: "shared_funding_source" as const,
      confidence: 0.91,
      confirmed: true,
      why: "Funded from same source within 3 minutes of launch",
      when: new Date(Date.now() - 47 * 60000).toISOString(),
    })),
    ...clusterWallets.slice(0, 5).map((w, i) => ({
      id: `eb-${i}`,
      from: w,
      to: clusterWallets[(i + 1) % 5],
      relation: "repeated_coordinated_behavior" as const,
      confidence: 0.78,
      confirmed: false,
      why: "Same-block buys with similar sizing",
    })),
  ];

  return { nodes, edges };
}

export function buildDemoWallet(address: string): WalletDna {
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
    frequentlyTradedDevelopers: [deployer],
  };
}

export function buildDemoRadar(): RadarCard[] {
  const base = buildDemoTokenScan();
  return [
    {
      address: base.address,
      name: base.name,
      symbol: base.symbol,
      marketCapUsd: base.marketCapUsd,
      liquidityUsd: base.liquidityUsd,
      volumeUsd: base.volumeUsd,
      buys1h: base.buys1h,
      sells1h: base.sells1h,
      uniqueBuyers: base.uniqueBuyers,
      holders: base.holders,
      ageMinutes: base.ageMinutes,
      connectedSupplyPct: base.connectedSupplyPct,
      vaneScore: base.vaneScore.total,
      alerts: ["Cluster transferring", "Elevated connected supply"],
      developerStatus: "holding",
    },
    {
      address: addr(0xf1),
      name: "Hooded Pengu",
      symbol: "HOODP",
      marketCapUsd: 210_000,
      liquidityUsd: 42_000,
      volumeUsd: 890_000,
      buys1h: 420,
      sells1h: 310,
      uniqueBuyers: 180,
      holders: 512,
      ageMinutes: 180,
      connectedSupplyPct: 9.4,
      vaneScore: 71,
      alerts: [],
      developerStatus: "holding",
    },
    {
      address: addr(0xf2),
      name: "Chainley",
      symbol: "RICK",
      marketCapUsd: 55_000,
      liquidityUsd: 18_000,
      volumeUsd: 120_000,
      buys1h: 90,
      sells1h: 70,
      uniqueBuyers: 64,
      holders: 140,
      ageMinutes: 25,
      connectedSupplyPct: 31.2,
      vaneScore: 41,
      alerts: ["High connected supply", "Fresh wallets 38%"],
      developerStatus: "selling",
    },
    {
      address: addr(0xf3),
      name: "Virtuals Gate",
      symbol: "VGATE",
      marketCapUsd: 340_000,
      liquidityUsd: 95_000,
      volumeUsd: 1_200_000,
      buys1h: 800,
      sells1h: 620,
      uniqueBuyers: 410,
      holders: 1200,
      ageMinutes: 720,
      connectedSupplyPct: 11.0,
      vaneScore: 68,
      alerts: ["Smart wallets entering"],
      developerStatus: "holding",
    },
  ];
}
