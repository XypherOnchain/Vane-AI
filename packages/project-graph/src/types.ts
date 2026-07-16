/** Crypto project memory — the code-to-chain graph (Pillar E). */

export type WalletRole = "watch" | "deployer" | "treasury" | "operator" | "test";
export type IncidentStatus = "open" | "investigating" | "resolved";
export type ExecutionMode = "simulation" | "testnet" | "live";

export interface ProjectWallet {
  address: string;
  role: WalletRole;
  label?: string;
  chainId?: number;
}

export interface ProjectContract {
  address: string;
  chainId: number;
  name?: string;
  abiPath?: string;
  deploymentTx?: string;
  isProduction: boolean;
}

/** Per-chain RPC slot — Robinhood first; ETH/Base ready for Phase 2. */
export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl?: string;
}

export interface Deployment {
  id: string;
  projectId: string;
  chainId: number;
  contractAddress: string;
  txHash?: string;
  label?: string;
  createdAt: string;
}

/** Env var *names* only — never secret values in AI prompts. */
export interface EnvVarName {
  name: string;
  note?: string;
}

export interface Project {
  id: string;
  name: string;
  repoPath?: string;
  githubUrl?: string;
  defaultBranch?: string;
  chains: number[];
  chainConfigs: ChainConfig[];
  telegramChatId?: string;
  wallets: ProjectWallet[];
  contracts: ProjectContract[];
  deployments: Deployment[];
  envVarNames: EnvVarName[];
  createdAt: string;
  updatedAt: string;
}

export interface Incident {
  id: string;
  projectId: string;
  txHash?: string;
  chainId?: number;
  title: string;
  summary?: string;
  revertReason?: string;
  status: IncidentStatus;
  relatedCode: { path: string; lines?: string; note?: string; selector?: string }[];
  proposedPatch?: string;
  testSketch?: string;
  simulation?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  projectId?: string;
  kind: string;
  mode: ExecutionMode;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface CreateProjectInput {
  name: string;
  repoPath?: string;
  githubUrl?: string;
  defaultBranch?: string;
  chains?: number[];
  chainConfigs?: ChainConfig[];
  telegramChatId?: string;
  envVarNames?: EnvVarName[];
}

export const DEFAULT_CHAIN_CONFIGS: ChainConfig[] = [
  { chainId: 4663, name: "Robinhood Chain" },
  { chainId: 1, name: "Ethereum" },
  { chainId: 8453, name: "Base" },
];
