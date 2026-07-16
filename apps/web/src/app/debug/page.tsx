"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiPatch, apiPost } from "@/lib/api";

interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl?: string;
}

interface Project {
  id: string;
  name: string;
  repoPath?: string;
  githubUrl?: string;
  defaultBranch?: string;
  chains: number[];
  chainConfigs: ChainConfig[];
  telegramChatId?: string;
  wallets: { address: string; role: string; label?: string }[];
  contracts: { address: string; name?: string; chainId: number }[];
  envVarNames: { name: string; note?: string }[];
}

const CHAIN_PRESETS: ChainConfig[] = [
  { chainId: 4663, name: "Robinhood Chain" },
  { chainId: 1, name: "Ethereum" },
  { chainId: 8453, name: "Base" },
];

export default function DebugWorkspacePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [backend, setBackend] = useState("memory");
  const [name, setName] = useState("Treasury Automation");
  const [githubUrl, setGithubUrl] = useState("");
  const [repoPath, setRepoPath] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [rpcUrl, setRpcUrl] = useState("");
  const [rpcChainId, setRpcChainId] = useState(4663);
  const [wallet, setWallet] = useState("");
  const [walletRole, setWalletRole] = useState("watch");
  const [envName, setEnvName] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [indexNote, setIndexNote] = useState<string | null>(null);

  async function refresh() {
    try {
      const data = await apiGet<{ items: Project[]; backend?: string }>("/v1/debug/projects");
      setProjects(data.items);
      if (data.backend) setBackend(data.backend);
      if (!activeId && data.items[0]) setActiveId(data.items[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load projects");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const active = projects.find((p) => p.id === activeId) ?? null;

  async function createProject() {
    setBusy(true);
    setError(null);
    try {
      const p = await apiPost<Project>("/v1/debug/projects", {
        name,
        githubUrl: githubUrl || undefined,
        repoPath: repoPath || undefined,
        defaultBranch,
        telegramChatId: telegramChatId || undefined,
        chains: [4663],
        chainConfigs: CHAIN_PRESETS,
      });
      setActiveId(p.id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveWorkspace() {
    if (!activeId) return;
    setBusy(true);
    setError(null);
    try {
      await apiPatch(`/v1/debug/projects/${activeId}`, {
        name: active?.name,
        githubUrl: githubUrl || active?.githubUrl,
        repoPath: repoPath || active?.repoPath,
        defaultBranch,
        telegramChatId: telegramChatId || active?.telegramChatId,
      });
      if (rpcUrl) {
        await apiPost(`/v1/debug/projects/${activeId}/rpc`, {
          chainId: rpcChainId,
          rpcUrl,
        });
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function addWallet() {
    if (!activeId || !wallet) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/v1/debug/projects/${activeId}/wallets`, {
        address: wallet,
        role: walletRole,
        label: walletRole === "treasury" ? "Treasury" : walletRole === "deployer" ? "Deployer" : undefined,
      });
      setWallet("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wallet add failed");
    } finally {
      setBusy(false);
    }
  }

  async function addEnvName() {
    if (!activeId || !envName.trim()) return;
    setBusy(true);
    try {
      await apiPost(`/v1/debug/projects/${activeId}/env-names`, { name: envName.trim() });
      setEnvName("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Env name add failed");
    } finally {
      setBusy(false);
    }
  }

  async function indexRepo() {
    if (!activeId) return;
    setBusy(true);
    setIndexNote(null);
    try {
      const data = await apiPost<{ fileCount: number; abiCount: number }>(
        `/v1/debug/projects/${activeId}/index-repo`,
        { repoPath: repoPath || active?.repoPath },
      );
      setIndexNote(`Indexed ${data.fileCount} files · ${data.abiCount} ABIs`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Index failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 px-4 py-8 md:grid-cols-[1fr_1.2fr] md:px-8">
      <section className="space-y-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-accent)]">
          Screen 1 · Workspace
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold">Connect project</h2>
        <p className="text-sm text-[var(--color-muted)]">
          GitHub URL + local path, per-chain RPC, watch-only wallets, Telegram chat id. Keys stay off
          the server. Graph backend: <span className="font-mono text-[var(--color-fg)]">{backend}</span>
        </p>

        <label className="block text-sm">
          Project name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-black/30 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          GitHub repo URL
          <input
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder="https://github.com/org/repo"
            className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-black/30 px-3 py-2 font-mono text-xs"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <label className="block text-sm">
            Local repo path (desktop)
            <input
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              placeholder="/Users/you/projects/treasury-bot"
              className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-black/30 px-3 py-2 font-mono text-xs"
            />
          </label>
          <label className="block text-sm">
            Branch
            <input
              value={defaultBranch}
              onChange={(e) => setDefaultBranch(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-black/30 px-3 py-2 font-mono text-xs"
            />
          </label>
        </div>

        <div className="rounded-lg border border-[var(--color-line)] p-3">
          <p className="text-sm font-medium">Chain + RPC</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Robinhood Chain first; Ethereum and Base slots ready for Phase 2.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              value={rpcChainId}
              onChange={(e) => setRpcChainId(Number(e.target.value))}
              className="rounded-lg border border-[var(--color-line)] bg-black/30 px-2 py-2 text-sm"
            >
              {CHAIN_PRESETS.map((c) => (
                <option key={c.chainId} value={c.chainId}>
                  {c.name} ({c.chainId})
                </option>
              ))}
            </select>
            <input
              value={rpcUrl}
              onChange={(e) => setRpcUrl(e.target.value)}
              placeholder="https://rpc…"
              className="min-w-[220px] flex-1 rounded-lg border border-[var(--color-line)] bg-black/30 px-3 py-2 font-mono text-xs"
            />
          </div>
        </div>

        <label className="block text-sm">
          Telegram chat id (alerts)
          <input
            value={telegramChatId}
            onChange={(e) => setTelegramChatId(e.target.value)}
            placeholder="-100…"
            className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-black/30 px-3 py-2 font-mono text-xs"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void createProject()}
            className="rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-[#04140d] disabled:opacity-50"
          >
            Create project
          </button>
          <button
            type="button"
            disabled={busy || !activeId}
            onClick={() => void saveWorkspace()}
            className="rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm disabled:opacity-50"
          >
            Save to active
          </button>
        </div>
        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      </section>

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">Projects</h2>
        <div className="flex flex-wrap gap-2">
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setActiveId(p.id);
                setGithubUrl(p.githubUrl ?? "");
                setRepoPath(p.repoPath ?? "");
                setDefaultBranch(p.defaultBranch ?? "main");
                setTelegramChatId(p.telegramChatId ?? "");
              }}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                activeId === p.id
                  ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                  : "border-[var(--color-line)] text-[var(--color-muted)]"
              }`}
            >
              {p.name}
            </button>
          ))}
          {projects.length === 0 && (
            <p className="text-sm text-[var(--color-muted)]">No projects yet — create one.</p>
          )}
        </div>

        {active && (
          <div className="space-y-4 rounded-xl border border-[var(--color-line)] p-4">
            <div>
              <h3 className="font-semibold">{active.name}</h3>
              <p className="mt-1 font-mono text-xs text-[var(--color-muted)]">
                {active.githubUrl || active.repoPath || "No repo"} · id {active.id.slice(0, 8)}…
              </p>
              <ul className="mt-2 space-y-1 text-xs text-[var(--color-muted)]">
                {(active.chainConfigs?.length ? active.chainConfigs : CHAIN_PRESETS).map((c) => (
                  <li key={c.chainId}>
                    {c.name}: {c.rpcUrl ? c.rpcUrl.replace(/\/\/.*@/, "//***@") : "RPC not set"}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-sm font-medium">Watch-only wallets</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  value={wallet}
                  onChange={(e) => setWallet(e.target.value)}
                  placeholder="0x… treasury / deployer"
                  className="min-w-[240px] flex-1 rounded-lg border border-[var(--color-line)] bg-black/30 px-3 py-2 font-mono text-xs"
                />
                <select
                  value={walletRole}
                  onChange={(e) => setWalletRole(e.target.value)}
                  className="rounded-lg border border-[var(--color-line)] bg-black/30 px-2 py-2 text-sm"
                >
                  <option value="watch">watch</option>
                  <option value="deployer">deployer</option>
                  <option value="treasury">treasury</option>
                  <option value="operator">operator</option>
                  <option value="test">test</option>
                </select>
                <button
                  type="button"
                  onClick={() => void addWallet()}
                  className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm"
                >
                  Add wallet
                </button>
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {active.wallets.map((w) => (
                  <li key={w.address} className="flex justify-between gap-2 font-mono text-xs">
                    <span>{w.address}</span>
                    <span className="text-[var(--color-muted)]">{w.role}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-sm font-medium">Env var names (never values)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  value={envName}
                  onChange={(e) => setEnvName(e.target.value)}
                  placeholder="RPC_URL"
                  className="flex-1 rounded-lg border border-[var(--color-line)] bg-black/30 px-3 py-2 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => void addEnvName()}
                  className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm"
                >
                  Add name
                </button>
              </div>
              <p className="mt-2 font-mono text-xs text-[var(--color-muted)]">
                {(active.envVarNames ?? []).map((e) => e.name).join(", ") || "none"}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              <button
                type="button"
                onClick={() => void indexRepo()}
                className="text-[var(--color-accent)]"
              >
                Index repo
              </button>
              {indexNote && <span className="text-[var(--color-muted)]">{indexNote}</span>}
              <Link href={`/debug/tx?projectId=${active.id}`} className="text-[var(--color-accent)]">
                Open Tx Inspector →
              </Link>
              <Link href="/debug/memory" className="text-[var(--color-muted)]">
                Project memory
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
