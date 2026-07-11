import { v4 as uuid } from "uuid";
import { loadEnv } from "@vane/config";
import type { RadarCard, SearchResult, TokenOverview, WalletDna } from "@vane/shared-types";
import { isLikelyAddress, isLikelyTx } from "@vane/shared-types";
import { cacheGet, cacheSet } from "./cache.js";

const env = loadEnv();

/**
 * Demo intelligence is ONLY available when VANE_DEMO_MODE is deliberately enabled.
 * When disabled (the default, and always in production), every lookup reports the
 * honest state: nothing is indexed yet.
 */
export const demoMode = env.demoMode;

const tokenStore = new Map<string, TokenOverview>();
const walletStore = new Map<string, WalletDna>();
const reports = new Map<
  string,
  { id: string; tokenAddress: string; summary: string; payload: unknown; createdAt: string }
>();
const alerts = new Map<
  string,
  {
    id: string;
    kind: string;
    tokenAddress?: string;
    telegramChatId?: string;
    rules: Record<string, unknown>;
    active: boolean;
    createdAt: string;
  }
>();

let demoSeed: typeof import("../data/demo.js") | null = null;

async function seedDemo() {
  demoSeed = await import("../data/demo.js");
  const { DEMO_TOKEN, buildRadar, buildTokenOverview, buildWallet } = demoSeed;
  const demo = markDemo(buildTokenOverview(DEMO_TOKEN));
  tokenStore.set(demo.address, demo);
  for (const card of buildRadar()) {
    if (!tokenStore.has(card.address)) {
      const t = buildTokenOverview(card.address);
      t.name = card.name;
      t.symbol = card.symbol;
      t.marketCapUsd = card.marketCapUsd;
      t.liquidityUsd = card.liquidityUsd;
      t.volume1hUsd = card.volume1hUsd;
      t.probableConnectedSupplyPct = card.connectedSupplyPct;
      t.connectedSupplyPct = card.connectedSupplyPct;
      t.integrity = { ...t.integrity, total: card.integrityScore };
      t.momentum = { ...t.momentum, total: card.momentumScore };
      t.holders = card.holders;
      t.ageMinutes = card.ageMinutes;
      t.processingState = card.processingState;
      t.launchpad = card.launchpad;
      tokenStore.set(card.address, markDemo(t));
    }
  }
  walletStore.set(demo.deployer, markDemoWallet(buildWallet(demo.deployer)));
}

function markDemo(t: TokenOverview): TokenOverview {
  return { ...t, dataSource: "demo" };
}

function markDemoWallet(w: WalletDna): WalletDna {
  return { ...w, dataSource: "demo" };
}

if (demoMode) {
  void seedDemo();
}

export function getToken(address: string): TokenOverview | null {
  if (!demoMode) return null;
  const key = address.toLowerCase();
  const existing = tokenStore.get(key);
  if (existing) return existing;
  if (demoSeed && key === demoSeed.DEMO_TOKEN) {
    return markDemo(demoSeed.buildTokenOverview(key));
  }
  return null;
}

export async function getTokenCached(address: string): Promise<TokenOverview | null> {
  if (!demoMode) return null;
  const key = `token:${address.toLowerCase()}`;
  const cached = await cacheGet(key);
  if (cached) return JSON.parse(cached) as TokenOverview;
  const token = getToken(address);
  if (token) await cacheSet(key, JSON.stringify(token), 20);
  return token;
}

export function listRadar(): RadarCard[] {
  if (!demoMode || !demoSeed) return [];
  return demoSeed
    .buildRadar()
    .map((c) => ({ ...c, dataSource: "demo" as const }))
    .sort((a, b) => a.ageMinutes - b.ageMinutes);
}

export function listNewPairs(): RadarCard[] {
  return listRadar().filter((t) => t.ageMinutes < 120);
}

export function listTrending(): RadarCard[] {
  return [...listRadar()].sort((a, b) => b.volume1hUsd - a.volume1hUsd);
}

export function getWallet(address: string): WalletDna | null {
  if (!demoMode || !demoSeed) return null;
  const key = address.toLowerCase();
  return (
    walletStore.get(key) ??
    (isLikelyAddress(key) ? markDemoWallet(demoSeed.buildWallet(key)) : null)
  );
}

export function getGraph(address: string) {
  if (!demoMode || !demoSeed) return null;
  const token = getToken(address);
  if (!token) return null;
  return { ...demoSeed.buildGraph(token.address), dataSource: "demo" as const };
}

export function search(q: string): SearchResult[] {
  const query = q.trim();
  if (!query) return [];
  if (isLikelyTx(query)) {
    return [{ type: "tx", id: query.toLowerCase(), title: "Transaction", subtitle: query }];
  }
  if (isLikelyAddress(query)) {
    const token = getToken(query);
    if (token) {
      return [
        { type: "token", id: token.address, title: `$${token.symbol}`, subtitle: token.name },
        {
          type: "wallet",
          id: query.toLowerCase(),
          title: "Open as wallet",
          subtitle: query.toLowerCase(),
        },
      ];
    }
    return [
      { type: "wallet", id: query.toLowerCase(), title: "Wallet", subtitle: query.toLowerCase() },
    ];
  }
  const lower = query.toLowerCase().replace(/^\$/, "");
  return [...tokenStore.values()]
    .filter((t) => t.symbol.toLowerCase().includes(lower) || t.name.toLowerCase().includes(lower))
    .slice(0, 10)
    .map((t) => ({
      type: "token" as const,
      id: t.address,
      title: `$${t.symbol}`,
      subtitle: t.name,
    }));
}

export function createReport(tokenAddress: string) {
  const token = getToken(tokenAddress);
  if (!token) return null;
  const id = uuid().slice(0, 8);
  const row = {
    id,
    tokenAddress: token.address,
    summary: token.summary,
    payload: token,
    createdAt: new Date().toISOString(),
  };
  reports.set(id, row);
  return row;
}

export function getReport(id: string) {
  return reports.get(id) ?? null;
}

export function createAlert(input: {
  kind: string;
  tokenAddress?: string;
  telegramChatId?: string;
  rules?: Record<string, unknown>;
}) {
  const id = uuid();
  const row = {
    id,
    kind: input.kind,
    tokenAddress: input.tokenAddress?.toLowerCase(),
    telegramChatId: input.telegramChatId,
    rules: input.rules ?? {},
    active: true,
    createdAt: new Date().toISOString(),
  };
  alerts.set(id, row);
  return row;
}

export function listAlerts(chatId?: string) {
  return [...alerts.values()].filter((a) => a.active && (!chatId || a.telegramChatId === chatId));
}

export function evaluateAlerts() {
  const fired: { alertId: string; message: string; telegramChatId?: string }[] = [];
  if (!demoMode) return fired;
  for (const a of alerts.values()) {
    if (!a.active || !a.tokenAddress) continue;
    const t = getToken(a.tokenAddress);
    if (!t) continue;
    if (a.kind === "cluster_sell" && t.cluster && t.cluster.confidence >= 0.8) {
      fired.push({
        alertId: a.id,
        telegramChatId: a.telegramChatId,
        message: `[DEMO] Cluster activity on $${t.symbol}: ${t.cluster.walletCount} wallets · ${t.probableConnectedSupplyPct}% probable connected`,
      });
    }
  }
  return fired;
}

export function metricsSnapshot() {
  return {
    demoMode,
    tokens: tokenStore.size,
    wallets: walletStore.size,
    alerts: alerts.size,
    reports: reports.size,
  };
}
