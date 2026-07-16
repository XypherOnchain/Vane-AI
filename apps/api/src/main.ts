import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { loadEnv } from "@vane/config";
import { createRobinhoodProvider } from "@vane/chain";
import { maybePolishWithLlm } from "./services/agent.js";
import { dbHealthy } from "./services/db.js";
import { getRedis } from "./services/cache.js";
import { debugRouter } from "./routes/debug.js";
import { buildRouter } from "./routes/build.js";
import { flowRouter } from "./routes/flow.js";
import { operateRouter } from "./routes/operate.js";
import { agentJobsRouter } from "./routes/agent.js";
import { runDebugAgent } from "./services/debug-agent.js";
import { getProjectStore } from "./services/project-store.js";
import {
  createAlert,
  createReport,
  demoMode,
  evaluateAlerts,
  getReport,
  listAlerts,
  metricsSnapshot,
} from "./services/store.js";
import { isLikelyTx } from "@vane/shared-types";

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

// --- Product API (Phase 1 = Vane Debug only) ---------------------------------
// Radar / new-pairs / trending / token intel were removed from the public
// product surface. Indexer services may still exist in-repo for later phases.

const GONE = {
  status: "gone" as const,
  message:
    "This endpoint was retired. Vane Phase 1 is Debug — use /v1/debug/* (workspace, tx inspector, incidents).",
};

function retired(_req: express.Request, res: express.Response) {
  res.status(410).json(GONE);
}

app.get("/v1/radar", retired);
app.get("/v1/new-pairs", retired);
app.get("/v1/trending", retired);
app.get(/^\/v1\/tokens(\/|$)/, retired);
app.get(/^\/v1\/wallets(\/|$)/, retired);

/** Debug search: tx hash → deep link hint; otherwise empty (use AI chat). */
app.get("/v1/search", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (isLikelyTx(q)) {
    return res.json({
      results: [
        {
          type: "tx",
          id: q.toLowerCase(),
          title: "Inspect transaction",
          subtitle: `/v1/debug/tx/${q.toLowerCase()}`,
        },
      ],
    });
  }
  res.json({ results: [] });
});

app.use("/v1/debug", debugRouter());
app.use("/v1/build", buildRouter());
app.use("/v1/flow", flowRouter());
app.use("/v1/operate", operateRouter());
app.use("/v1/agent-jobs", agentJobsRouter());

app.post("/v1/ai/query", aiQuery);
app.post("/v1/agent", aiQuery);

async function aiQuery(req: express.Request, res: express.Response) {
  const question = String(req.body?.question ?? "");
  if (!question.trim()) return res.status(400).json({ error: "question required" });
  const store = await getProjectStore();
  let answer = await runDebugAgent(question, {
    store,
    projectId: req.body?.projectId ? String(req.body.projectId) : undefined,
    webUrl: env.APP_URL,
  });
  // Optional LLM polish — never reintroduce secrets
  const polished = await maybePolishWithLlm(
    {
      answer: answer.answer,
      citations: answer.citations.map((c) => ({
        label: c.label,
        href: c.href ?? `${env.APP_URL}/debug`,
      })),
      toolsUsed: answer.toolsUsed,
      suggestedFollowUps: answer.suggestedFollowUps,
    },
    env.AI_PROVIDER_API_KEY,
    env.AI_MODEL,
  );
  res.json({ ...polished, toolsUsed: answer.toolsUsed, redacted: answer.redacted, demoMode });
}

app.post("/v1/reports", (req, res) => {
  const report = createReport(String(req.body?.tokenAddress ?? ""));
  if (!report) return res.status(410).json(GONE);
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
