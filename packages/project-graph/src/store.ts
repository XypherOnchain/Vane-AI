import { randomUUID } from "node:crypto";
import type {
  AuditEvent,
  CreateProjectInput,
  ExecutionMode,
  Incident,
  Project,
  ProjectContract,
  ProjectWallet,
} from "./types.js";

/**
 * In-process project memory for Phase 1.
 * Postgres persistence lands when DATABASE_URL + migration 004 are applied;
 * this store keeps Debug MVP usable without Docker.
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
    const project: Project = {
      id: randomUUID(),
      name: input.name.trim() || "Untitled project",
      repoPath: input.repoPath,
      githubUrl: input.githubUrl,
      chains: input.chains?.length ? input.chains : [4663],
      telegramChatId: input.telegramChatId,
      wallets: [],
      contracts: [],
      createdAt: now,
      updatedAt: now,
    };
    this.projects.set(project.id, project);
    this.audit({ projectId: project.id, kind: "project.created", mode: "simulation", payload: { name: project.name } });
    return project;
  }

  updateProject(id: string, patch: Partial<CreateProjectInput>): Project | null {
    const p = this.projects.get(id);
    if (!p) return null;
    if (patch.name != null) p.name = patch.name;
    if (patch.repoPath !== undefined) p.repoPath = patch.repoPath;
    if (patch.githubUrl !== undefined) p.githubUrl = patch.githubUrl;
    if (patch.chains) p.chains = patch.chains;
    if (patch.telegramChatId !== undefined) p.telegramChatId = patch.telegramChatId;
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
    Object.assign(i, patch, { id: i.id, createdAt: i.createdAt, updatedAt: new Date().toISOString() });
    return i;
  }

  audit(input: { projectId?: string; kind: string; mode: ExecutionMode; payload: Record<string, unknown> }) {
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
}

export const defaultProjectStore = new ProjectGraphStore();
