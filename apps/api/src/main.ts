import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { loadEnv } from "@vane/config";
import { createRobinhoodProvider } from "@vane/chain";
import { maybePolishWithLlm, runAgent } from "./services/agent.js";
import { dbHealthy } from "./services/db.js";
import { getRedis } from "./services/cache.js";
import {
  createAlert,
  createReport,
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

app.use(cors({ origin: true }));
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

app.get("/health", async (_req, res) => {
  const redis = getRedis();
  let redisOk = false;
  if (redis) {
    try {
      redisOk = (await redis.ping()) === "PONG";
    } catch {
      redisOk = false;
    }
  }
  const chain = await provider.healthCheck();
  res.json({
    ok: true,
    service: "vane-api",
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    postgres: await dbHealthy(),
    redis: redisOk,
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
      `vane_requests_total ${requestCount}\nvane_tokens_indexed ${m.tokens}\nvane_alerts_active ${m.alerts}\n`,
    );
});

app.get("/v1/search", (req, res) => {
  res.json({ results: search(String(req.query.q ?? "")) });
});

app.get("/v1/radar", (_req, res) => res.json({ items: listRadar() }));
app.get("/v1/new-pairs", (_req, res) => res.json({ items: listNewPairs() }));
app.get("/v1/trending", (_req, res) => res.json({ items: listTrending() }));

app.get("/v1/tokens/:address", async (req, res) => {
  const token = await getTokenCached(req.params.address);
  if (!token) return res.status(404).json({ error: "Token not found" });
  res.json(token);
});

app.get("/v1/tokens/:address/overview", async (req, res) => {
  const token = await getTokenCached(req.params.address);
  if (!token) return res.status(404).json({ error: "Token not found" });
  res.json(token);
});

app.get("/v1/tokens/:address/graph", (req, res) => {
  const graph = getGraph(req.params.address);
  if (!graph) return res.status(404).json({ error: "Graph not found" });
  res.json(graph);
});

app.get("/v1/tokens/:address/scores", async (req, res) => {
  const token = await getTokenCached(req.params.address);
  if (!token) return res.status(404).json({ error: "Token not found" });
  res.json({
    integrity: token.integrity,
    momentum: token.momentum,
    dataConfidence: token.dataConfidence,
  });
});

app.get("/v1/tokens/:address/contract", async (req, res) => {
  const token = await getTokenCached(req.params.address);
  if (!token) return res.status(404).json({ error: "Token not found" });
  res.json({ findings: token.findings });
});

app.get("/v1/tokens/:address/clusters", async (req, res) => {
  const token = await getTokenCached(req.params.address);
  if (!token) return res.status(404).json({ error: "Token not found" });
  res.json({ cluster: token.cluster });
});

app.get("/v1/wallets/:address", (req, res) => {
  const wallet = getWallet(req.params.address);
  if (!wallet) return res.status(404).json({ error: "Wallet not found" });
  res.json(wallet);
});

app.post("/v1/ai/query", async (req, res) => {
  const question = String(req.body?.question ?? "");
  if (!question.trim()) return res.status(400).json({ error: "question required" });
  let answer = runAgent(question, { getToken, getWallet, webUrl: env.APP_URL }, req.body?.tokenAddress);
  answer = await maybePolishWithLlm(answer, env.AI_PROVIDER_API_KEY, env.AI_MODEL);
  res.json(answer);
});

app.post("/v1/agent", async (req, res) => {
  const question = String(req.body?.question ?? "");
  if (!question.trim()) return res.status(400).json({ error: "question required" });
  let answer = runAgent(question, { getToken, getWallet, webUrl: env.APP_URL }, req.body?.tokenAddress);
  answer = await maybePolishWithLlm(answer, env.AI_PROVIDER_API_KEY, env.AI_MODEL);
  res.json(answer);
});

app.post("/v1/reports", (req, res) => {
  const report = createReport(String(req.body?.tokenAddress ?? ""));
  if (!report) return res.status(404).json({ error: "Token not found" });
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

app.post("/v1/alerts/evaluate", (_req, res) => res.json({ fired: evaluateAlerts() }));

/** Telegram webhook stubs (Phase 0 Task 9) — secret validated, update deduped later in DB */
app.post("/internal/telegram/:botType/webhook", (req, res) => {
  const secret = req.header("x-telegram-bot-api-secret-token");
  const expected =
    req.params.botType === "pairs"
      ? env.TELEGRAM_PAIRS_WEBHOOK_SECRET
      : env.TELEGRAM_INTELLIGENCE_WEBHOOK_SECRET;
  if (expected && secret !== expected) {
    return res.status(401).json({ error: "invalid webhook secret" });
  }
  const updateId = req.body?.update_id;
  res.json({ ok: true, received: true, updateId, botType: req.params.botType });
});

app.listen(env.API_PORT, () => {
  console.log(`Vane API listening on :${env.API_PORT}`);
});
