import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { loadEnv } from "@vane/config";
import { createRobinhoodProvider } from "@vane/chain";
import { maybePolishWithLlm, runAgent } from "./services/agent.js";
import { dbHealthy } from "./services/db.js";
import { getRedis } from "./services/cache.js";
import { listIndexedRadar } from "./services/indexed.js";
import {
  createAlert,
  createReport,
  demoMode,
  evaluateAlerts,
  getGraph,
  getReport,
  getToken,
  getTokenCached,
  getWallet,
  listAlerts,
  listNewPairs,
  listRadar,
  listTrending,
  metricsSnapshot,
  search,
} from "./services/store.js";

const env = loadEnv();
const app = express();
const provider = createRobinhoodProvider(env);
const startedAt = Date.now();
let requestCount = 0;

// --- CORS ---------------------------------------------------------------
// In production only origins explicitly listed in CORS_ORIGINS are allowed.
// In development, localhost plus the configured app URL are allowed.
const allowedOrigins = new Set(
  env.isProduction
    ? (env.CORS_ORIGINS ?? "")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    : [env.APP_URL, "http://localhost:3000", "http://127.0.0.1:3000"],
);

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin / server-to-server requests carry no Origin header.
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error("Origin not allowed"), false);
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use((req, _res, next) => {
  requestCount += 1;
  next();
});
app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// --- Internal route guard -------------------------------------------------
function requireInternalSecret(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  if (!env.INTERNAL_API_SECRET) {
    // Without a configured secret, internal routes are only usable in dev/test.
    if (env.isProduction) return res.status(503).json({ error: "internal routes disabled" });
    return next();
  }
  if (req.header("x-internal-secret") !== env.INTERNAL_API_SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

// --- Health ---------------------------------------------------------------
async function checkRedis(): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    return (await redis.ping()) === "PONG";
  } catch {
    return false;
  }
}

/** Liveness: the process is up and can serve HTTP. Nothing else. */
app.get("/health/live", (_req, res) => {
  res.json({
    ok: true,
    service: "vane-api",
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
  });
});

/**
 * Readiness: fails (503) when PostgreSQL, Redis, or the required RPC provider
 * is not genuinely reachable. Load balancers should route traffic only when
 * this endpoint returns 200.
 */
app.get("/health/ready", async (_req, res) => {
  const [postgres, redis, chain] = await Promise.all([
    dbHealthy(),
    checkRedis(),
    provider.healthCheck().catch(() => null),
  ]);
  const chainOk = Boolean(
    chain &&
    (chain as { ok?: boolean }).ok !== false &&
    (chain as { tipBlock?: string | null }).tipBlock,
  );
  const ready = postgres && redis && chainOk;
  res.status(ready ? 200 : 503).json({
    ready,
    demoMode,
    checks: { postgres, redis, rpc: chainOk },
    chain,
  });
});

/** Summary endpoint kept for dashboards; not used for orchestration. */
app.get("/health", async (_req, res) => {
  const [postgres, redis, chain] = await Promise.all([
    dbHealthy(),
    checkRedis(),
    provider.healthCheck().catch(() => null),
  ]);
  res.json({
    ok: true,
    service: "vane-api",
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    postgres,
    redis,
    chain,
    requests: requestCount,
    ...metricsSnapshot(),
  });
});

app.get("/metrics", (_req, res) => {
  const m = metricsSnapshot();
  res
    .type("text/plain")
    .send(
      `vane_requests_total ${requestCount}\nvane_demo_mode ${demoMode ? 1 : 0}\nvane_tokens_indexed ${m.tokens}\nvane_alerts_active ${m.alerts}\n`,
    );
});

// --- Data endpoints ---------------------------------------------------------
// When demo mode is off (the default) and real indexing has not yet populated
// the database, these endpoints honestly report "not_indexed" instead of
// substituting simulated findings.
const NOT_INDEXED = {
  status: "not_indexed" as const,
  message: "This data is not indexed yet. Vane never substitutes simulated findings.",
};

app.get("/v1/search", (req, res) => {
  res.json({ results: search(String(req.query.q ?? "")), demoMode });
});

app.get("/v1/radar", async (_req, res) => {
  if (demoMode) return res.json({ items: listRadar(), demoMode });
  const items = await listIndexedRadar();
  if (!items || items.length === 0) return res.json({ items: [], ...NOT_INDEXED });
  res.json({ items, demoMode: false });
});

app.get("/v1/new-pairs", async (_req, res) => {
  if (demoMode) return res.json({ items: listNewPairs(), demoMode });
  const items = await listIndexedRadar();
  if (!items || items.length === 0) return res.json({ items: [], ...NOT_INDEXED });
  res.json({ items: items.filter((t) => t.ageMinutes < 24 * 60), demoMode: false });
});

app.get("/v1/trending", async (_req, res) => {
  if (demoMode) return res.json({ items: listTrending(), demoMode });
  // Trending requires real volume metrics, which are not computed yet.
  // Until pricing lands, trending honestly reports the same new-launch feed.
  const items = await listIndexedRadar();
  if (!items || items.length === 0) return res.json({ items: [], ...NOT_INDEXED });
  res.json({ items, demoMode: false, note: "volume ranking pending market-data pipeline" });
});

async function tokenOr404(req: express.Request, res: express.Response) {
  const token = await getTokenCached(req.params.address as string);
  if (!token) {
    res.status(404).json({ error: "Token not indexed", ...NOT_INDEXED });
    return null;
  }
  return token;
}

app.get("/v1/tokens/:address", async (req, res) => {
  const token = await tokenOr404(req, res);
  if (token) res.json(token);
});

app.get("/v1/tokens/:address/overview", async (req, res) => {
  const token = await tokenOr404(req, res);
  if (token) res.json(token);
});

app.get("/v1/tokens/:address/graph", (req, res) => {
  const graph = getGraph(req.params.address);
  if (!graph) return res.status(404).json({ error: "Graph not available", ...NOT_INDEXED });
  res.json(graph);
});

app.get("/v1/tokens/:address/scores", async (req, res) => {
  const token = await tokenOr404(req, res);
  if (!token) return;
  res.json({
    dataSource: token.dataSource,
    integrity: token.integrity,
    momentum: token.momentum,
    dataConfidence: token.dataConfidence,
  });
});

app.get("/v1/tokens/:address/contract", async (req, res) => {
  const token = await tokenOr404(req, res);
  if (token) res.json({ dataSource: token.dataSource, findings: token.findings });
});

app.get("/v1/tokens/:address/clusters", async (req, res) => {
  const token = await tokenOr404(req, res);
  if (token) res.json({ dataSource: token.dataSource, cluster: token.cluster });
});

app.get("/v1/wallets/:address", (req, res) => {
  const wallet = getWallet(req.params.address);
  if (!wallet) return res.status(404).json({ error: "Wallet not indexed", ...NOT_INDEXED });
  res.json(wallet);
});

app.post("/v1/ai/query", aiQuery);
app.post("/v1/agent", aiQuery);

async function aiQuery(req: express.Request, res: express.Response) {
  const question = String(req.body?.question ?? "");
  if (!question.trim()) return res.status(400).json({ error: "question required" });
  let answer = runAgent(
    question,
    { getToken, getWallet, webUrl: env.APP_URL },
    req.body?.tokenAddress,
  );
  answer = await maybePolishWithLlm(answer, env.AI_PROVIDER_API_KEY, env.AI_MODEL);
  res.json({ ...answer, demoMode });
}

app.post("/v1/reports", (req, res) => {
  const report = createReport(String(req.body?.tokenAddress ?? ""));
  if (!report) return res.status(404).json({ error: "Token not indexed", ...NOT_INDEXED });
  res.status(201).json({ ...report, url: `${env.APP_URL}/r/${report.id}` });
});

app.get("/v1/reports/:id", (req, res) => {
  const report = getReport(req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found" });
  res.json(report);
});

app.post("/v1/alerts", (req, res) => {
  res.status(201).json(
    createAlert({
      kind: String(req.body?.kind ?? "cluster_sell"),
      tokenAddress: req.body?.tokenAddress,
      telegramChatId: req.body?.telegramChatId ? String(req.body.telegramChatId) : undefined,
      rules: req.body?.rules ?? {},
    }),
  );
});

app.get("/v1/alerts", (req, res) => {
  res.json({ items: listAlerts(req.query.chatId ? String(req.query.chatId) : undefined) });
});

// Alert evaluation is an internal operation. It is never publicly callable.
app.post("/internal/alerts/evaluate", requireInternalSecret, (_req, res) =>
  res.json({ fired: evaluateAlerts() }),
);

/** Telegram webhook stubs — secret validated; update dedupe lands with the DB layer */
app.post("/internal/telegram/:botType/webhook", (req, res) => {
  const secret = req.header("x-telegram-bot-api-secret-token");
  const expected =
    req.params.botType === "pairs"
      ? env.TELEGRAM_PAIRS_WEBHOOK_SECRET
      : env.TELEGRAM_INTELLIGENCE_WEBHOOK_SECRET;
  if (env.isProduction && !expected) {
    return res.status(503).json({ error: "webhook secret not configured" });
  }
  if (expected && secret !== expected) {
    return res.status(401).json({ error: "invalid webhook secret" });
  }
  const updateId = req.body?.update_id;
  res.json({ ok: true, received: true, updateId, botType: req.params.botType });
});

app.listen(env.API_PORT, () => {
  console.log(`Vane API listening on :${env.API_PORT} (env=${env.NODE_ENV}, demoMode=${demoMode})`);
});
