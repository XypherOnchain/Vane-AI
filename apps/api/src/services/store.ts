import { v4 as uuid } from "uuid";
import type {
  RadarCard,
  SearchResult,
  TokenScan,
  WalletDna,
} from "@vane/shared";
import { isLikelyAddress, isLikelyTx } from "@vane/shared";
import {
  DEMO_NASDAQ,
  buildDemoGraph,
  buildDemoRadar,
  buildDemoTokenScan,
  buildDemoWallet,
} from "../data/demo.js";
import { cacheGet, cacheSet } from "./cache.js";

const tokenStore = new Map<string, TokenScan>();
const walletStore = new Map<string, WalletDna>();
const reports = new Map<string, { id: string; tokenAddress: string; summary: string; payload: unknown; createdAt: string }>();
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

function seed() {
  const demo = buildDemoTokenScan(DEMO_NASDAQ);
  tokenStore.set(demo.address, demo);
  for (const card of buildDemoRadar()) {
    if (!tokenStore.has(card.address)) {
      const t = buildDemoTokenScan(card.address);
      t.name = card.name;
      t.symbol = card.symbol;
      t.marketCapUsd = card.marketCapUsd;
      t.liquidityUsd = card.liquidityUsd;
      t.volumeUsd = card.volumeUsd;
      t.connectedSupplyPct = card.connectedSupplyPct;
      t.vaneScore = { ...t.vaneScore, total: card.vaneScore };
      t.holders = card.holders;
      t.ageMinutes = card.ageMinutes;
      tokenStore.set(card.address, t);
    }
  }
  walletStore.set(demo.deployer, buildDemoWallet(demo.deployer));
  if (demo.cluster) {
    for (const w of demo.cluster.wallets.slice(0, 3)) {
      walletStore.set(w, buildDemoWallet(w));
    }
  }
}

seed();

export function upsertToken(scan: TokenScan) {
  tokenStore.set(scan.address.toLowerCase(), scan);
}

export function getToken(address: string): TokenScan | null {
  const key = address.toLowerCase();
  return tokenStore.get(key) ?? (key === DEMO_NASDAQ ? buildDemoTokenScan(key) : null);
}

export async function getTokenCached(address: string): Promise<TokenScan | null> {
  const key = `token:${address.toLowerCase()}`;
  const cached = await cacheGet(key);
  if (cached) return JSON.parse(cached) as TokenScan;
  const token = getToken(address);
  if (token) await cacheSet(key, JSON.stringify(token), 20);
  return token;
}

export function listRadar(): RadarCard[] {
  return [...tokenStore.values()]
    .map((t) => ({
      address: t.address,
      name: t.name,
      symbol: t.symbol,
      marketCapUsd: t.marketCapUsd,
      liquidityUsd: t.liquidityUsd,
      volumeUsd: t.volumeUsd,
      buys1h: t.buys1h,
      sells1h: t.sells1h,
      uniqueBuyers: t.uniqueBuyers,
      holders: t.holders,
      ageMinutes: t.ageMinutes,
      connectedSupplyPct: t.connectedSupplyPct,
      vaneScore: t.vaneScore.total,
      alerts:
        t.connectedSupplyPct > 20
          ? ["Elevated connected supply"]
          : t.cluster && t.cluster.confidence > 0.8
            ? ["Cluster watch"]
            : [],
      developerStatus: "holding" as const,
    }))
    .sort((a, b) => a.ageMinutes - b.ageMinutes);
}

export function getWallet(address: string): WalletDna | null {
  const key = address.toLowerCase();
  return walletStore.get(key) ?? (isLikelyAddress(key) ? buildDemoWallet(key) : null);
}

export function getGraph(address: string) {
  const token = getToken(address);
  if (!token) return null;
  return buildDemoGraph(token.address);
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
        {
          type: "token",
          id: token.address,
          title: `$${token.symbol}`,
          subtitle: token.name,
        },
      ];
    }
    return [
      {
        type: "wallet",
        id: query.toLowerCase(),
        title: "Wallet",
        subtitle: query.toLowerCase(),
      },
    ];
  }
  const lower = query.toLowerCase().replace(/^\$/, "");
  return [...tokenStore.values()]
    .filter(
      (t) =>
        t.symbol.toLowerCase().includes(lower) ||
        t.name.toLowerCase().includes(lower),
    )
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
  return [...alerts.values()].filter(
    (a) => a.active && (!chatId || a.telegramChatId === chatId),
  );
}

export function evaluateAlerts(): {
  alertId: string;
  message: string;
  telegramChatId?: string;
}[] {
  const fired: { alertId: string; message: string; telegramChatId?: string }[] = [];
  for (const a of alerts.values()) {
    if (!a.active || !a.tokenAddress) continue;
    const t = getToken(a.tokenAddress);
    if (!t) continue;
    if (a.kind === "cluster_sell" && t.cluster && t.cluster.confidence >= 0.8) {
      fired.push({
        alertId: a.id,
        telegramChatId: a.telegramChatId,
        message: `⚠ Cluster activity on $${t.symbol}: ${t.cluster.walletCount} wallets · ${t.connectedSupplyPct}% connected · confidence ${Math.round(t.cluster.confidence * 100)}%`,
      });
    }
    if (a.kind === "dev_sell") {
      fired.push({
        alertId: a.id,
        telegramChatId: a.telegramChatId,
        message: `👁 Developer watch active for $${t.symbol} (${t.deployer})`,
      });
    }
  }
  return fired;
}

export function metricsSnapshot() {
  return {
    tokens: tokenStore.size,
    wallets: walletStore.size,
    alerts: alerts.size,
    reports: reports.size,
  };
}
