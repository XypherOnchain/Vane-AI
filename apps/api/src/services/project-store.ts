import {
  defaultProjectStore,
  PostgresProjectStore,
  type CreateProjectInput,
  type Deployment,
  type EnvVarName,
  type ExecutionMode,
  type Incident,
  type Project,
  type ProjectContract,
  type ProjectWallet,
} from "@vane/project-graph";
import { getPool } from "./db.js";

/**
 * Unified async facade: Postgres when DATABASE_URL works, else in-memory.
 */
export type ProjectStoreFacade = {
  listProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | null>;
  createProject(input: CreateProjectInput): Promise<Project>;
  updateProject(id: string, patch: Partial<CreateProjectInput>): Promise<Project | null>;
  setChainRpc(projectId: string, chainId: number, rpcUrl: string): Promise<Project | null>;
  addWallet(projectId: string, wallet: ProjectWallet): Promise<Project | null>;
  addContract(projectId: string, contract: ProjectContract): Promise<Project | null>;
  addDeployment(
    projectId: string,
    input: Omit<Deployment, "id" | "projectId" | "createdAt">,
  ): Promise<Deployment | null>;
  addEnvVarName(projectId: string, env: EnvVarName): Promise<Project | null>;
  createIncident(
    input: Omit<Incident, "id" | "createdAt" | "updatedAt" | "status" | "relatedCode"> & {
      status?: Incident["status"];
      relatedCode?: Incident["relatedCode"];
    },
  ): Promise<Incident>;
  listIncidents(projectId?: string): Promise<Incident[]>;
  getIncident(id: string): Promise<Incident | null>;
  updateIncident(id: string, patch: Partial<Incident>): Promise<Incident | null>;
  audit(input: {
    projectId?: string;
    kind: string;
    mode: ExecutionMode;
    payload: Record<string, unknown>;
  }): Promise<unknown>;
  listAudits(projectId?: string, limit?: number): Promise<unknown[]>;
  resolveAddressRoles(
    projectId: string,
    addresses: string[],
  ): Promise<{ address: string; role?: string; label?: string; kind: "wallet" | "contract" | "unknown" }[]>;
  backend: "postgres" | "memory";
};

let cached: ProjectStoreFacade | null = null;
let pgTried = false;

function memoryFacade(): ProjectStoreFacade {
  const s = defaultProjectStore;
  return {
    backend: "memory",
    listProjects: async () => s.listProjects(),
    getProject: async (id) => s.getProject(id),
    createProject: async (input) => s.createProject(input),
    updateProject: async (id, patch) => s.updateProject(id, patch),
    setChainRpc: async (projectId, chainId, rpcUrl) => s.setChainRpc(projectId, chainId, rpcUrl),
    addWallet: async (projectId, wallet) => s.addWallet(projectId, wallet),
    addContract: async (projectId, contract) => s.addContract(projectId, contract),
    addDeployment: async (projectId, input) => s.addDeployment(projectId, input),
    addEnvVarName: async (projectId, env) => s.addEnvVarName(projectId, env),
    createIncident: async (input) => s.createIncident(input),
    listIncidents: async (projectId) => s.listIncidents(projectId),
    getIncident: async (id) => s.getIncident(id),
    updateIncident: async (id, patch) => s.updateIncident(id, patch),
    audit: async (input) => s.audit(input),
    listAudits: async (projectId, limit) => s.listAudits(projectId, limit),
    resolveAddressRoles: async (projectId, addresses) => s.resolveAddressRoles(projectId, addresses),
  };
}

export async function getProjectStore(): Promise<ProjectStoreFacade> {
  if (cached) return cached;
  const pool = getPool();
  if (pool && !pgTried) {
    pgTried = true;
    try {
      await pool.query("SELECT 1 FROM projects LIMIT 1");
      const pg = new PostgresProjectStore({
        query: (text, params) => pool.query(text, params),
      });
      cached = {
        backend: "postgres",
        listProjects: () => pg.listProjects(),
        getProject: (id) => pg.getProject(id),
        createProject: (input) => pg.createProject(input),
        updateProject: (id, patch) => pg.updateProject(id, patch),
        setChainRpc: (projectId, chainId, rpcUrl) => pg.setChainRpc(projectId, chainId, rpcUrl),
        addWallet: (projectId, wallet) => pg.addWallet(projectId, wallet),
        addContract: (projectId, contract) => pg.addContract(projectId, contract),
        addDeployment: (projectId, input) => pg.addDeployment(projectId, input),
        addEnvVarName: (projectId, env) => pg.addEnvVarName(projectId, env),
        createIncident: (input) => pg.createIncident(input),
        listIncidents: (projectId) => pg.listIncidents(projectId),
        getIncident: (id) => pg.getIncident(id),
        updateIncident: (id, patch) => pg.updateIncident(id, patch),
        audit: (input) => pg.audit(input),
        listAudits: (projectId, limit) => pg.listAudits(projectId, limit),
        resolveAddressRoles: (projectId, addresses) => pg.resolveAddressRoles(projectId, addresses),
      };
      return cached;
    } catch {
      /* fall through to memory — tables may not exist yet */
    }
  }
  cached = memoryFacade();
  return cached;
}
