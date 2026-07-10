import { z } from "zod";

export const ethAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address");

export const txHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash");

export type EthAddress = z.infer<typeof ethAddressSchema>;

export const RELATION_LABELS = [
  "confirmed_connection",
  "shared_funding_source",
  "repeated_coordinated_behavior",
  "probable_common_controller",
  "potential_relationship",
  "insufficient_evidence",
] as const;

export type RelationLabel = (typeof RELATION_LABELS)[number];

export const WALLET_DNA_CLASSES = [
  "Early Launch Trader",
  "Momentum Trader",
  "Graduation Buyer",
  "Fast Scalper",
  "Long-Term Holder",
  "Developer-Linked Wallet",
  "Liquidity Provider",
  "High-Risk Sniper",
  "Coordinated Cluster Participant",
  "Consistent Profitable Trader",
  "High Win Rate, Poor Risk Control",
  "Low Win Rate, Large Outlier Wins",
] as const;

export type WalletDnaClass = (typeof WALLET_DNA_CLASSES)[number];

export interface ScoreBreakdown {
  total: number;
  contractIntegrity: number;
  distribution: number;
  developerHistory: number;
  liquidityQuality: number;
  marketIntegrity: number;
  walletQuality: number;
  momentum: number;
  social: number;
  evidence: Record<string, string[]>;
}

export interface HolderRow {
  address: string;
  pctSupply: number;
  balance: string;
  isContract?: boolean;
  isLp?: boolean;
  clusterId?: string;
}

export interface ClusterSummary {
  id: string;
  confidence: number;
  supplyPct: number;
  walletCount: number;
  wallets: string[];
  signals: {
    sharedFunding: "strong" | "moderate" | "weak" | "none";
    sameBlock: "strong" | "moderate" | "weak" | "none";
    similarSizing: "strong" | "moderate" | "weak" | "none";
    historicalCoordination: "strong" | "moderate" | "weak" | "none";
    commonExit: "confirmed" | "inferred" | "none";
  };
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  relation: RelationLabel;
  confidence: number;
  confirmed: boolean;
  why: string;
  when?: string;
  txHashes?: string[];
}

export interface GraphNode {
  id: string;
  address: string;
  size: number;
  label?: string;
  clusterId?: string;
  isDeployer?: boolean;
}

export interface TokenScan {
  address: string;
  chainId: number;
  name: string;
  symbol: string;
  decimals: number;
  priceUsd: number;
  marketCapUsd: number;
  fdvUsd: number;
  liquidityUsd: number;
  volumeUsd: number;
  buys1h: number;
  sells1h: number;
  holders: number;
  uniqueBuyers: number;
  ageMinutes: number;
  athFdvUsd: number;
  athMinutesAgo: number | null;
  deployer: string;
  deployerFunding?: string;
  previousLaunches: PreviousLaunch[];
  topHolders: HolderRow[];
  connectedSupplyPct: number;
  freshWalletPct: number;
  securityTags: string[];
  contract: ContractIntel;
  vaneScore: ScoreBreakdown;
  cluster: ClusterSummary | null;
  summary: string;
  indexing: boolean;
}

export interface PreviousLaunch {
  address: string;
  symbol: string;
  athFdvUsd: number;
  outcomePct: number;
  launchedAt: string;
}

export interface ContractIntel {
  verified: boolean;
  ownershipRenounced: boolean;
  upgradeable: boolean;
  mintable: boolean;
  freezable: boolean;
  blacklist: boolean;
  transferTaxBps: number;
  maxTxPct: number | null;
  liquidityLocked: boolean;
}

export interface WalletDna {
  address: string;
  dnaClass: WalletDnaClass;
  walletAgeDays: number;
  fundingOrigin?: string;
  winRate: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  medianEntryMinutes: number;
  medianPositionEth: number;
  medianHoldMinutes: number;
  completedWins: number;
  completedTotal: number;
  associatedClusterSize: number;
  recentBehaviorNote: string;
  frequentlyTradedDevelopers: string[];
}

export interface RadarCard {
  address: string;
  name: string;
  symbol: string;
  marketCapUsd: number;
  liquidityUsd: number;
  volumeUsd: number;
  buys1h: number;
  sells1h: number;
  uniqueBuyers: number;
  holders: number;
  ageMinutes: number;
  connectedSupplyPct: number;
  vaneScore: number;
  alerts: string[];
  developerStatus: "holding" | "selling" | "unknown";
}

export interface AgentAnswer {
  answer: string;
  citations: { label: string; href: string }[];
  toolsUsed: string[];
  suggestedFollowUps: string[];
}

export interface SearchResult {
  type: "token" | "wallet" | "tx";
  id: string;
  title: string;
  subtitle?: string;
}

export function shortAddress(addr: string, chars = 4): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 2 + chars)}…${addr.slice(-chars)}`;
}

export function formatUsd(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(digits)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toExponential(2)}`;
}

export function formatPct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

export function isLikelyAddress(input: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(input.trim());
}

export function isLikelyTx(input: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(input.trim());
}
