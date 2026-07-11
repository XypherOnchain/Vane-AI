import { z } from "zod";

export const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address")
  .transform((a) => a.toLowerCase());

export const txHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash")
  .transform((h) => h.toLowerCase());

export type Address = z.infer<typeof addressSchema>;

export const TOKEN_PROCESSING_STATES = [
  "DETECTED",
  "METADATA_PENDING",
  "METADATA_READY",
  "MARKET_PENDING",
  "MARKET_READY",
  "SCAN_PENDING",
  "SCAN_READY",
  "GRAPH_PENDING",
  "GRAPH_READY",
  "PUBLISHED",
  "FAILED_PARTIAL",
  "UNSUPPORTED",
] as const;

export type TokenProcessingState = (typeof TOKEN_PROCESSING_STATES)[number];

export interface IntegrityScore {
  total: number;
  contractSafety: number;
  distributionQuality: number;
  liquidityQuality: number;
  developerHistory: number;
  marketIntegrity: number;
  version: string;
  evidence: Record<string, string[]>;
}

export interface MomentumScore {
  total: number;
  version: string;
  evidence: string[];
}

export interface DataConfidence {
  level: "high" | "medium" | "low";
  score: number;
  reasons: string[];
}

export interface ScanFinding {
  id: string;
  tokenAddress: string;
  ruleId: string;
  ruleVersion: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  summary: string;
  technicalDetails: string;
  confidence: number;
  status: "confirmed" | "probable" | "possible";
  evidenceIds: string[];
  createdAt: string;
}

export interface HolderRow {
  address: string;
  pctSupply: number;
  balance: string;
  label?: string;
  isContract?: boolean;
  isLp?: boolean;
  clusterId?: string;
}

export interface ClusterSummary {
  id: string;
  confidence: number;
  classification:
    | "confirmed_relationship"
    | "shared_funding"
    | "coordinated_behavior"
    | "probable_common_control";
  supplyPct: number;
  confirmedSupplyPct: number;
  probableSupplyPct: number;
  walletCount: number;
  wallets: string[];
  signals: {
    sharedFunding: "strong" | "moderate" | "weak" | "none";
    sameBlock: "strong" | "moderate" | "weak" | "none";
    similarSizing: "strong" | "moderate" | "weak" | "none";
    historicalCoordination: "strong" | "moderate" | "weak" | "none";
    commonExit: "confirmed" | "inferred" | "none";
  };
  evidenceIds: string[];
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  relation: string;
  confidence: number;
  confirmed: boolean;
  why: string;
  when?: string;
  txHashes?: string[];
  evidenceIds: string[];
}

export interface GraphNode {
  id: string;
  address: string;
  size: number;
  category:
    | "deployer"
    | "deployer_linked"
    | "probable_cluster"
    | "liquidity_pool"
    | "contract"
    | "smart_wallet"
    | "unclassified";
  label?: string;
  clusterId?: string;
}

/**
 * Marks where a payload came from. "demo" payloads are simulated demonstrations
 * (only served when VANE_DEMO_MODE is enabled) and must be visibly labeled in
 * every surface. "indexed" payloads come from real chain data.
 */
export type DataSource = "indexed" | "demo";

export interface TokenOverview {
  dataSource?: DataSource;
  address: string;
  chainId: number;
  name: string;
  symbol: string;
  decimals: number;
  priceUsd: number;
  marketCapUsd: number;
  fdvUsd: number;
  liquidityUsd: number;
  volume1hUsd: number;
  volume24hUsd: number;
  buys1h: number;
  sells1h: number;
  holders: number;
  uniqueBuyers: number;
  ageMinutes: number;
  athFdvUsd: number;
  athMinutesAgo: number | null;
  deployer: string;
  deployerFunding?: string;
  launchpad?: string;
  processingState: TokenProcessingState;
  topHolders: HolderRow[];
  connectedSupplyPct: number;
  confirmedConnectedSupplyPct: number;
  probableConnectedSupplyPct: number;
  freshWalletPct: number;
  integrity: IntegrityScore;
  momentum: MomentumScore;
  dataConfidence: DataConfidence;
  cluster: ClusterSummary | null;
  findings: ScanFinding[];
  summary: string;
  summaryEvidenceIds: string[];
  warnings: { text: string; href: string; severity: "critical" | "high" | "medium" }[];
}

export interface RadarCard {
  dataSource?: DataSource;
  address: string;
  name: string;
  symbol: string;
  marketCapUsd: number;
  liquidityUsd: number;
  volume1hUsd: number;
  buys1h: number;
  sells1h: number;
  uniqueBuyers: number;
  holders: number;
  ageMinutes: number;
  connectedSupplyPct: number;
  integrityScore: number;
  momentumScore: number;
  launchpad?: string;
  status: string;
  processingState: TokenProcessingState;
  alerts: string[];
  developerStatus: "holding" | "selling" | "unknown";
  dataReady: {
    market: boolean;
    holders: boolean;
    contract: boolean;
    graph: boolean;
  };
}

export interface WalletDna {
  dataSource?: DataSource;
  address: string;
  dnaClass: string;
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
}

export interface SearchResult {
  type: "token" | "wallet" | "tx" | "developer" | "pool";
  id: string;
  title: string;
  subtitle?: string;
}

export interface AgentAnswer {
  answer: string;
  citations: { label: string; href: string; evidenceId?: string }[];
  toolsUsed: string[];
  suggestedFollowUps: string[];
}

export function normalizeAddress(addr: string): string {
  return addr.trim().toLowerCase();
}

export function shortAddress(addr: string, chars = 4): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 2 + chars)}…${addr.slice(-chars)}`;
}

export function formatUsd(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (Math.abs(n) >= 1) return `$${n.toFixed(digits)}`;
  if (Math.abs(n) >= 0.0001) return `$${n.toFixed(6)}`;
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

export function classifySearchInput(
  input: string,
): "address" | "tx" | "symbol" | "question" | "empty" {
  const q = input.trim();
  if (!q) return "empty";
  if (isLikelyTx(q)) return "tx";
  if (isLikelyAddress(q)) return "address";
  if (/\?|\b(what|why|who|how|is|show|compare)\b/i.test(q) || q.split(/\s+/).length > 3) {
    return "question";
  }
  return "symbol";
}
