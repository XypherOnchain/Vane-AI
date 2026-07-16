"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/api";

interface Project {
  id: string;
  name: string;
  repoPath?: string;
  githubUrl?: string;
  chains: number[];
  telegramChatId?: string;
  wallets: { address: string; role: string; label?: string }[];
  contracts: { address: string; name?: string; chainId: number }[];
}

export default function DebugWorkspacePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("Treasury Automation");
  const [repoPath, setRepoPath] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [wallet, setWallet] = useState("");
  const [walletRole, setWalletRole] = useState("watch");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const data = await apiGet<{ items: Project[] }>("/v1/debug/projects");
      setProjects(data.items);
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
        repoPath: repoPath || undefined,
        telegramChatId: telegramChatId || undefined,
        chains: [4663],
      });
      setActiveId(p.id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
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
        label: walletRole === "treasury" ? "Treasury" : undefined,
      });
      setWallet("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wallet add failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 px-4 py-8 md:grid-cols-[1fr_1.2fr] md:px-8">
      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">New workspace</h2>
        <p className="text-sm text-[var(--color-muted)]">
          Screen 1 of Vane Debug — connect a local repo path, Robinhood Chain, watch-only wallets,
          and optional Telegram for failure alerts.
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
          Local repo path
          <input
            value={repoPath}
            onChange={(e) => setRepoPath(e.target.value)}
            placeholder="/Users/you/projects/treasury-bot"
            className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-black/30 px-3 py-2 font-mono text-xs"
          />
        </label>
        <label className="block text-sm">
          Telegram chat id (alerts)
          <input
            value={telegramChatId}
            onChange={(e) => setTelegramChatId(e.target.value)}
            placeholder="-100…"
            className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-black/30 px-3 py-2 font-mono text-xs"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void createProject()}
          className="rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-[#04140d] disabled:opacity-50"
        >
          Create project
        </button>
        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      </section>

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">Projects</h2>
        <div className="flex flex-wrap gap-2">
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiveId(p.id)}
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
          <div className="rounded-xl border border-[var(--color-line)] p-4">
            <h3 className="font-semibold">{active.name}</h3>
            <p className="mt-1 font-mono text-xs text-[var(--color-muted)]">
              {active.repoPath || "No repo path"} · chains {active.chains.join(", ")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                placeholder="0x… watch-only wallet"
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
            <ul className="mt-4 space-y-2 text-sm">
              {active.wallets.map((w) => (
                <li key={w.address} className="flex justify-between gap-2 font-mono text-xs">
                  <span>{w.address}</span>
                  <span className="text-[var(--color-muted)]">{w.role}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <Link href="/debug/tx" className="text-[var(--color-accent)]">
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
