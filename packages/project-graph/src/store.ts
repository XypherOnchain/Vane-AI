import { randomUUID } from "node:crypto";
import {
  DEFAULT_CHAIN_CONFIGS,
  type AuditEvent,
  type ChainConfig,
  type CreateProjectInput,
  type Deployment,
  type EnvVarName,
  type ExecutionMode,
  type Incident,
  type Project,
  type ProjectContract,
  type ProjectWallet,
} from "./types.js";

/**
 * In-process project memory for Phase 1.
 * Postgres persistence is used when DATABASE_URL is set (see postgres-store).
 */
export class ProjectGraphStore {
  private projects = new Map<string, Project>();
  private incidents = new Map<string, Incident>();
  private audits: AuditEvent[] = [];

  listProjects(): Project[] {
    return [...this.projects.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  getProject(id: string): Project | null {
    return this.projects.get(id) ?? null;
  }

  createProject(input: CreateProjectInput): Project {
    const now = new Date().toISOString();
    const chainConfigs =
      input.chainConfigs?.length ?
        input.chainConfigs
      : DEFAULT_CHAIN_CONFIGS.map((c) => ({ ...c }));
    const chains =
      input.chains?.length ? input.chains : chainConfigs.map((c) => c.chainId).filter((id) => id === 4663);
    const project: Project = {
      id: randomUUID(),
      name: input.name.trim() || "Untitled project",
      repoPath: input.repoPath,
      githubUrl: input.githubUrl,
      defaultBranch: input.defaultBranch ?? "main",
      chains: chains.length ? chains : [4663],
      chainConfigs,
      telegramChatId: input.telegramChatId,
      wallets: [],
      contracts: [],
      deployments: [],
      envVarNames: input.envVarNames ?? [],
      createdAt: now,
      updatedAt: now,
    };
    this.projects.set(project.id, project);
    this.audit({
      projectId: project.id,
      kind: "project.created",
      mode: "simulation",
      payload: { name: project.name },
    });
    return project;
  }

  updateProject(
    id: string,
    patch: Partial<CreateProjectInput> & { chainConfigs?: ChainConfig[]; envVarNames?: EnvVarName[] },
  ): Project | null {
    const p = this.projects.get(id);
    if (!p) return null;
    if (patch.name != null) p.name = patch.name;
    if (patch.repoPath !== undefined) p.repoPath = patch.repoPath;
    if (patch.githubUrl !== undefined) p.githubUrl = patch.githubUrl;
    if (patch.defaultBranch !== undefined) p.defaultBranch = patch.defaultBranch;
    if (patch.chains) p.chains = patch.chains;
    if (patch.chainConfigs) p.chainConfigs = patch.chainConfigs;
    if (patch.telegramChatId !== undefined) p.telegramChatId = patch.telegramChatId;
    if (patch.envVarNames) p.envVarNames = patch.envVarNames;
    p.updatedAt = new Date().toISOString();
    return p;
  }

  setChainRpc(projectId: string, chainId: number, rpcUrl: string): Project | null {
    const p = this.projects.get(projectId);
    if (!p) return null;
    const existing = p.chainConfigs.find((c) => c.chainId === chainId);
    if (existing) {
      existing.rpcUrl = rpcUrl;
    } else {
      const known = DEFAULT_CHAIN_CONFIGS.find((c) => c.chainId === chainId);
      p.chainConfigs.push({
        chainId,
        name: known?.name ?? `Chain ${chainId}`,
        rpcUrl,
      });
    }
    if (!p.chains.includes(chainId)) p.chains.push(chainId);
    p.updatedAt = new Date().toISOString();
    return p;
  }

  addWallet(projectId: string, wallet: ProjectWallet): Project | null {
    const p = this.projects.get(projectId);
    if (!p) return null;
    const addr = wallet.address.toLowerCase();
    p.wallets = p.wallets.filter((w) => w.address !== addr);
    p.wallets.push({ ...wallet, address: addr });
    p.updatedAt = new Date().toISOString();
    this.audit({
      projectId,
      kind: "wallet.added",
      mode: "simulation",
      payload: { address: addr, role: wallet.role },
    });
    return p;
  }

  addContract(projectId: string, contract: ProjectContract): Project | null {
    const p = this.projects.get(projectId);
    if (!p) return null;
    const addr = contract.address.toLowerCase();
    p.contracts = p.contracts.filter(
      (c) => !(c.address === addr && c.chainId === contract.chainId),
    );
    p.contracts.push({ ...contract, address: addr });
    p.updatedAt = new Date().toISOString();
    return p;
  }

  addDeployment(
    projectId: string,
    input: Omit<Deployment, "id" | "projectId" | "createdAt">,
  ): Deployment | null {
    const p = this.projects.get(projectId);
    if (!p) return null;
    const deployment: Deployment = {
      id: randomUUID(),
      projectId,
      chainId: input.chainId,
      contractAddress: input.contractAddress.toLowerCase(),
      txHash: input.txHash?.toLowerCase(),
      label: input.label,
      createdAt: new Date().toISOString(),
    };
    p.deployments.push(deployment);
    p.updatedAt = new Date().toISOString();
    return deployment;
  }

  addEnvVarName(projectId: string, env: EnvVarName): Project | null {
    const p = this.projects.get(projectId);
    if (!p) return null;
    const name = env.name.trim();
    if (!name) return p;
    p.envVarNames = p.envVarNames.filter((e) => e.name !== name);
    p.envVarNames.push({ name, note: env.note });
    p.updatedAt = new Date().toISOString();
    return p;
  }

  createIncident(
    input: Omit<Incident, "id" | "createdAt" | "updatedAt" | "status" | "relatedCode"> & {
      status?: Incident["status"];
      relatedCode?: Incident["relatedCode"];
    },
  ): Incident {
    const now = new Date().toISOString();
    const incident: Incident = {
      id: randomUUID(),
      projectId: input.projectId,
      txHash: input.txHash?.toLowerCase(),
      chainId: input.chainId,
      title: input.title,
      summary: input.summary,
      revertReason: input.revertReason,
      status: input.status ?? "open",
      relatedCode: input.relatedCode ?? [],
      proposedPatch: input.proposedPatch,
      testSketch: input.testSketch,
      simulation: input.simulation,
      createdAt: now,
      updatedAt: now,
    };
    this.incidents.set(incident.id, incident);
    this.audit({
      projectId: input.projectId,
      kind: "incident.created",
      mode: "simulation",
      payload: { id: incident.id, txHash: incident.txHash, title: incident.title },
    });
    return incident;
  }

  listIncidents(projectId?: string): Incident[] {
    const all = [...this.incidents.values()];
    const filtered = projectId ? all.filter((i) => i.projectId === projectId) : all;
    return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getIncident(id: string): Incident | null {
    return this.incidents.get(id) ?? null;
  }

  updateIncident(id: string, patch: Partial<Incident>): Incident | null {
    const i = this.incidents.get(id);
    if (!i) return null;
    Object.assign(i, patch, {
      id: i.id,
      createdAt: i.createdAt,
      updatedAt: new Date().toISOString(),
    });
    return i;
  }

  audit(input: {
    projectId?: string;
    kind: string;
    mode: ExecutionMode;
    payload: Record<string, unknown>;
  }) {
    const event: AuditEvent = {
      id: randomUUID(),
      projectId: input.projectId,
      kind: input.kind,
      mode: input.mode,
      payload: input.payload,
      createdAt: new Date().toISOString(),
    };
    this.audits.unshift(event);
    if (this.audits.length > 2_000) this.audits.length = 2_000;
    return event;
  }

  listAudits(projectId?: string, limit = 50): AuditEvent[] {
    const rows = projectId ? this.audits.filter((a) => a.projectId === projectId) : this.audits;
    return rows.slice(0, limit);
  }

  /** Resolve wallet/contract roles for addresses seen in a tx. */
  resolveAddressRoles(
    projectId: string,
    addresses: string[],
  ): { address: string; role?: string; label?: string; kind: "wallet" | "contract" | "unknown" }[] {
    const p = this.projects.get(projectId);
    if (!p) {
      return addresses.map((a) => ({ address: a.toLowerCase(), kind: "unknown" as const }));
    }
    return addresses.map((raw) => {
      const address = raw.toLowerCase();
      const wallet = p.wallets.find((w) => w.address === address);
      if (wallet) {
        return { address, role: wallet.role, label: wallet.label, kind: "wallet" as const };
      }
      const contract = p.contracts.find((c) => c.address === address);
      if (contract) {
        return {
          address,
          role: contract.isProduction ? "production" : "contract",
          label: contract.name,
          kind: "contract" as const,
        };
      }
      return { address, kind: "unknown" as const };
    });
  }
}

export const defaultProjectStore = new ProjectGraphStore();
