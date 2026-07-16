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

export interface Project {
  id: string;
  name: string;
  repoPath?: string;
  githubUrl?: string;
  chains: number[];
  telegramChatId?: string;
  wallets: ProjectWallet[];
  contracts: ProjectContract[];
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
  relatedCode: { path: string; lines?: string; note?: string }[];
  proposedPatch?: string;
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
  chains?: number[];
  telegramChatId?: string;
}
