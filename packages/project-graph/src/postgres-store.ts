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

/** Minimal pg-compatible query interface so this package does not hard-depend on `pg`. */
export interface PgQueryable {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
}

type ProjectRow = {
  id: string;
  name: string;
  repo_path: string | null;
  github_url: string | null;
  default_branch: string | null;
  chains: number[] | string;
  chain_configs: ChainConfig[] | string;
  env_var_names: EnvVarName[] | string;
  telegram_chat_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function parseJson<T>(value: T | string, fallback: T): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return (value ?? fallback) as T;
}

function iso(d: Date | string): string {
  return typeof d === "string" ? new Date(d).toISOString() : d.toISOString();
}

/**
 * Postgres-backed project graph. Apply migrations 004 + 005 first.
 */
export class PostgresProjectStore {
  constructor(private readonly db: PgQueryable) {}

  private async hydrate(row: ProjectRow): Promise<Project> {
    const wallets = await this.db.query<{
      address: string;
      role: string;
      label: string | null;
      chain_id: number | null;
    }>(
      `SELECT address, role, label, chain_id FROM project_wallets WHERE project_id = $1`,
      [row.id],
    );
    const contracts = await this.db.query<{
      address: string;
      chain_id: number;
      name: string | null;
      abi_path: string | null;
      deployment_tx: string | null;
      is_production: boolean;
    }>(
      `SELECT address, chain_id, name, abi_path, deployment_tx, is_production
       FROM project_contracts WHERE project_id = $1`,
      [row.id],
    );
    const deployments = await this.db.query<{
      id: string;
      project_id: string;
      chain_id: number;
      contract_address: string;
      tx_hash: string | null;
      label: string | null;
      created_at: Date | string;
    }>(
      `SELECT id, project_id, chain_id, contract_address, tx_hash, label, created_at
       FROM project_deployments WHERE project_id = $1 ORDER BY created_at DESC`,
      [row.id],
    );

    const chainConfigs = parseJson(row.chain_configs, [] as ChainConfig[]);
    return {
      id: row.id,
      name: row.name,
      repoPath: row.repo_path ?? undefined,
      githubUrl: row.github_url ?? undefined,
      defaultBranch: row.default_branch ?? "main",
      chains: parseJson(row.chains, [4663]),
      chainConfigs: chainConfigs.length ? chainConfigs : DEFAULT_CHAIN_CONFIGS.map((c) => ({ ...c })),
      telegramChatId: row.telegram_chat_id ?? undefined,
      envVarNames: parseJson(row.env_var_names, [] as EnvVarName[]),
      wallets: wallets.rows.map((w) => ({
        address: w.address,
        role: w.role as ProjectWallet["role"],
        label: w.label ?? undefined,
        chainId: w.chain_id ?? undefined,
      })),
      contracts: contracts.rows.map((c) => ({
        address: c.address,
        chainId: c.chain_id,
        name: c.name ?? undefined,
        abiPath: c.abi_path ?? undefined,
        deploymentTx: c.deployment_tx ?? undefined,
        isProduction: c.is_production,
      })),
      deployments: deployments.rows.map((d) => ({
        id: d.id,
        projectId: d.project_id,
        chainId: d.chain_id,
        contractAddress: d.contract_address,
        txHash: d.tx_hash ?? undefined,
        label: d.label ?? undefined,
        createdAt: iso(d.created_at),
      })),
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
    };
  }

  async listProjects(): Promise<Project[]> {
    const r = await this.db.query<ProjectRow>(
      `SELECT * FROM projects ORDER BY updated_at DESC`,
    );
    const out: Project[] = [];
    for (const row of r.rows) out.push(await this.hydrate(row));
    return out;
  }

  async getProject(id: string): Promise<Project | null> {
    const r = await this.db.query<ProjectRow>(`SELECT * FROM projects WHERE id = $1`, [id]);
    if (!r.rows[0]) return null;
    return this.hydrate(r.rows[0]);
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    const id = randomUUID();
    const now = new Date();
    const chainConfigs =
      input.chainConfigs?.length ?
        input.chainConfigs
      : DEFAULT_CHAIN_CONFIGS.map((c) => ({ ...c }));
    const chains = input.chains?.length ? input.chains : [4663];
    await this.db.query(
      `INSERT INTO projects
        (id, name, repo_path, github_url, default_branch, chains, chain_configs, env_var_names, telegram_chat_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10,$10)`,
      [
        id,
        input.name.trim() || "Untitled project",
        input.repoPath ?? null,
        input.githubUrl ?? null,
        input.defaultBranch ?? "main",
        JSON.stringify(chains),
        JSON.stringify(chainConfigs),
        JSON.stringify(input.envVarNames ?? []),
        input.telegramChatId ?? null,
        now,
      ],
    );
    await this.audit({
      projectId: id,
      kind: "project.created",
      mode: "simulation",
      payload: { name: input.name },
    });
    return (await this.getProject(id))!;
  }

  async updateProject(
    id: string,
    patch: Partial<CreateProjectInput> & { chainConfigs?: ChainConfig[]; envVarNames?: EnvVarName[] },
  ): Promise<Project | null> {
    const current = await this.getProject(id);
    if (!current) return null;
    const next = {
      name: patch.name ?? current.name,
      repoPath: patch.repoPath !== undefined ? patch.repoPath : current.repoPath,
      githubUrl: patch.githubUrl !== undefined ? patch.githubUrl : current.githubUrl,
      defaultBranch: patch.defaultBranch !== undefined ? patch.defaultBranch : current.defaultBranch,
      chains: patch.chains ?? current.chains,
      chainConfigs: patch.chainConfigs ?? current.chainConfigs,
      telegramChatId:
        patch.telegramChatId !== undefined ? patch.telegramChatId : current.telegramChatId,
      envVarNames: patch.envVarNames ?? current.envVarNames,
    };
    await this.db.query(
      `UPDATE projects SET
        name = $2, repo_path = $3, github_url = $4, default_branch = $5,
        chains = $6::jsonb, chain_configs = $7::jsonb, env_var_names = $8::jsonb,
        telegram_chat_id = $9, updated_at = NOW()
       WHERE id = $1`,
      [
        id,
        next.name,
        next.repoPath ?? null,
        next.githubUrl ?? null,
        next.defaultBranch ?? "main",
        JSON.stringify(next.chains),
        JSON.stringify(next.chainConfigs),
        JSON.stringify(next.envVarNames),
        next.telegramChatId ?? null,
      ],
    );
    return this.getProject(id);
  }

  async setChainRpc(projectId: string, chainId: number, rpcUrl: string): Promise<Project | null> {
    const p = await this.getProject(projectId);
    if (!p) return null;
    const configs = [...p.chainConfigs];
    const existing = configs.find((c) => c.chainId === chainId);
    if (existing) existing.rpcUrl = rpcUrl;
    else {
      const known = DEFAULT_CHAIN_CONFIGS.find((c) => c.chainId === chainId);
      configs.push({ chainId, name: known?.name ?? `Chain ${chainId}`, rpcUrl });
    }
    const chains = p.chains.includes(chainId) ? p.chains : [...p.chains, chainId];
    return this.updateProject(projectId, { chainConfigs: configs, chains });
  }

  async addWallet(projectId: string, wallet: ProjectWallet): Promise<Project | null> {
    const p = await this.getProject(projectId);
    if (!p) return null;
    const addr = wallet.address.toLowerCase();
    await this.db.query(
      `INSERT INTO project_wallets (project_id, address, role, label, chain_id)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (project_id, address) DO UPDATE SET role = $3, label = $4, chain_id = $5`,
      [projectId, addr, wallet.role, wallet.label ?? null, wallet.chainId ?? null],
    );
    await this.db.query(`UPDATE projects SET updated_at = NOW() WHERE id = $1`, [projectId]);
    await this.audit({
      projectId,
      kind: "wallet.added",
      mode: "simulation",
      payload: { address: addr, role: wallet.role },
    });
    return this.getProject(projectId);
  }

  async addContract(projectId: string, contract: ProjectContract): Promise<Project | null> {
    const p = await this.getProject(projectId);
    if (!p) return null;
    const addr = contract.address.toLowerCase();
    await this.db.query(
      `INSERT INTO project_contracts
        (project_id, address, chain_id, name, abi_path, deployment_tx, is_production)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (project_id, chain_id, address) DO UPDATE SET
         name = $4, abi_path = $5, deployment_tx = $6, is_production = $7`,
      [
        projectId,
        addr,
        contract.chainId,
        contract.name ?? null,
        contract.abiPath ?? null,
        contract.deploymentTx ?? null,
        contract.isProduction,
      ],
    );
    await this.db.query(`UPDATE projects SET updated_at = NOW() WHERE id = $1`, [projectId]);
    return this.getProject(projectId);
  }

  async addDeployment(
    projectId: string,
    input: Omit<Deployment, "id" | "projectId" | "createdAt">,
  ): Promise<Deployment | null> {
    const p = await this.getProject(projectId);
    if (!p) return null;
    const id = randomUUID();
    const createdAt = new Date();
    await this.db.query(
      `INSERT INTO project_deployments
        (id, project_id, chain_id, contract_address, tx_hash, label, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        id,
        projectId,
        input.chainId,
        input.contractAddress.toLowerCase(),
        input.txHash?.toLowerCase() ?? null,
        input.label ?? null,
        createdAt,
      ],
    );
    await this.db.query(`UPDATE projects SET updated_at = NOW() WHERE id = $1`, [projectId]);
    return {
      id,
      projectId,
      chainId: input.chainId,
      contractAddress: input.contractAddress.toLowerCase(),
      txHash: input.txHash?.toLowerCase(),
      label: input.label,
      createdAt: createdAt.toISOString(),
    };
  }

  async addEnvVarName(projectId: string, env: EnvVarName): Promise<Project | null> {
    const p = await this.getProject(projectId);
    if (!p) return null;
    const name = env.name.trim();
    if (!name) return p;
    const envVarNames = [...p.envVarNames.filter((e) => e.name !== name), { name, note: env.note }];
    return this.updateProject(projectId, { envVarNames });
  }

  async createIncident(
    input: Omit<Incident, "id" | "createdAt" | "updatedAt" | "status" | "relatedCode"> & {
      status?: Incident["status"];
      relatedCode?: Incident["relatedCode"];
    },
  ): Promise<Incident> {
    const id = randomUUID();
    const now = new Date();
    const incident: Incident = {
      id,
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
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    await this.db.query(
      `INSERT INTO incidents
        (id, project_id, tx_hash, chain_id, title, summary, revert_reason, status,
         related_code, proposed_patch, test_sketch, simulation, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12::jsonb,$13,$13)`,
      [
        id,
        incident.projectId,
        incident.txHash ?? null,
        incident.chainId ?? null,
        incident.title,
        incident.summary ?? null,
        incident.revertReason ?? null,
        incident.status,
        JSON.stringify(incident.relatedCode),
        incident.proposedPatch ?? null,
        incident.testSketch ?? null,
        JSON.stringify(incident.simulation ?? null),
        now,
      ],
    );
    await this.audit({
      projectId: input.projectId,
      kind: "incident.created",
      mode: "simulation",
      payload: { id, txHash: incident.txHash, title: incident.title },
    });
    return incident;
  }

  async listIncidents(projectId?: string): Promise<Incident[]> {
    const r = projectId
      ? await this.db.query<Record<string, unknown>>(
          `SELECT * FROM incidents WHERE project_id = $1 ORDER BY created_at DESC`,
          [projectId],
        )
      : await this.db.query<Record<string, unknown>>(
          `SELECT * FROM incidents ORDER BY created_at DESC`,
        );
    return r.rows.map((row) => this.mapIncident(row));
  }

  async getIncident(id: string): Promise<Incident | null> {
    const r = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM incidents WHERE id = $1`,
      [id],
    );
    if (!r.rows[0]) return null;
    return this.mapIncident(r.rows[0]);
  }

  private mapIncident(row: Record<string, unknown>): Incident {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      txHash: row.tx_hash ? String(row.tx_hash) : undefined,
      chainId: row.chain_id != null ? Number(row.chain_id) : undefined,
      title: String(row.title),
      summary: row.summary ? String(row.summary) : undefined,
      revertReason: row.revert_reason ? String(row.revert_reason) : undefined,
      status: String(row.status) as Incident["status"],
      relatedCode: parseJson(row.related_code as Incident["relatedCode"] | string, []),
      proposedPatch: row.proposed_patch ? String(row.proposed_patch) : undefined,
      testSketch: row.test_sketch ? String(row.test_sketch) : undefined,
      simulation: parseJson(row.simulation as Record<string, unknown> | string | null, undefined as unknown as Record<string, unknown>) || undefined,
      createdAt: iso(row.created_at as Date | string),
      updatedAt: iso(row.updated_at as Date | string),
    };
  }

  async updateIncident(id: string, patch: Partial<Incident>): Promise<Incident | null> {
    const current = await this.getIncident(id);
    if (!current) return null;
    const next = { ...current, ...patch, id: current.id, createdAt: current.createdAt };
    await this.db.query(
      `UPDATE incidents SET
        title = $2, summary = $3, revert_reason = $4, status = $5,
        related_code = $6::jsonb, proposed_patch = $7, test_sketch = $8,
        simulation = $9::jsonb, updated_at = NOW()
       WHERE id = $1`,
      [
        id,
        next.title,
        next.summary ?? null,
        next.revertReason ?? null,
        next.status,
        JSON.stringify(next.relatedCode),
        next.proposedPatch ?? null,
        next.testSketch ?? null,
        JSON.stringify(next.simulation ?? null),
      ],
    );
    return this.getIncident(id);
  }

  async audit(input: {
    projectId?: string;
    kind: string;
    mode: ExecutionMode;
    payload: Record<string, unknown>;
  }): Promise<AuditEvent> {
    const event: AuditEvent = {
      id: randomUUID(),
      projectId: input.projectId,
      kind: input.kind,
      mode: input.mode,
      payload: input.payload,
      createdAt: new Date().toISOString(),
    };
    await this.db.query(
      `INSERT INTO audit_events (id, project_id, kind, mode, payload, created_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
      [
        event.id,
        event.projectId ?? null,
        event.kind,
        event.mode,
        JSON.stringify(event.payload),
        new Date(event.createdAt),
      ],
    );
    return event;
  }

  async listAudits(projectId?: string, limit = 50): Promise<AuditEvent[]> {
    const r = projectId
      ? await this.db.query<{
          id: string;
          project_id: string | null;
          kind: string;
          mode: string;
          payload: Record<string, unknown> | string;
          created_at: Date | string;
        }>(
          `SELECT * FROM audit_events WHERE project_id = $1 ORDER BY created_at DESC LIMIT $2`,
          [projectId, limit],
        )
      : await this.db.query<{
          id: string;
          project_id: string | null;
          kind: string;
          mode: string;
          payload: Record<string, unknown> | string;
          created_at: Date | string;
        }>(`SELECT * FROM audit_events ORDER BY created_at DESC LIMIT $1`, [limit]);
    return r.rows.map((row) => ({
      id: row.id,
      projectId: row.project_id ?? undefined,
      kind: row.kind,
      mode: row.mode as ExecutionMode,
      payload: parseJson(row.payload, {}),
      createdAt: iso(row.created_at),
    }));
  }

  async resolveAddressRoles(
    projectId: string,
    addresses: string[],
  ): Promise<{ address: string; role?: string; label?: string; kind: "wallet" | "contract" | "unknown" }[]> {
    const p = await this.getProject(projectId);
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
