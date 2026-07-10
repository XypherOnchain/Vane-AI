import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { maybePolishWithLlm, runAgent } from "./services/agent.js";
import { dbHealthy } from "./services/db.js";
import { getRedis } from "./services/cache.js";
import {
  createAlert,
  createReport,
  evaluateAlerts,
  getGraph,
  getReport,
  getTokenCached,
  getWallet,
  listAlerts,
  listRadar,
  metricsSnapshot,
  search,
  getToken,
} from "./services/store.js";

const app = express();
const port = Number(process.env.API_PORT ?? 4000);
const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
const startedAt = Date.now();
let requestCount = 0;

app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  requestCount += 1;
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    if (ms > 500) {
      console.warn(`[slow] ${req.method} ${req.path} ${ms}ms`);
    }
  });
  next();
});

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
const max = Number(process.env.RATE_LIMIT_MAX ?? 120);
app.use(
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Rate limit exceeded. Upgrade to Vane Pro for higher limits." },
  }),
);

/** Optional API key gate for future Pro / partner traffic */
app.use((req, res, next) => {
  const required = process.env.API_KEY;
  if (!required) return next();
  if (req.path === "/health" || req.path === "/metrics") return next();
  const key = req.header("x-api-key");
  if (key !== required) {
    return res.status(401).json({ error: "Invalid or missing API key" });
  }
  return next();
});

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
  res.json({
    ok: true,
    service: "vane-api",
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    postgres: await dbHealthy(),
    redis: redisOk,
    requests: requestCount,
    ...metricsSnapshot(),
  });
});

app.get("/metrics", (_req, res) => {
  const m = metricsSnapshot();
  res.type("text/plain").send(
    [
      `# HELP vane_requests_total Total HTTP requests`,
      `# TYPE vane_requests_total counter`,
      `vane_requests_total ${requestCount}`,
      `# HELP vane_tokens_indexed Indexed tokens`,
      `# TYPE vane_tokens_indexed gauge`,
      `vane_tokens_indexed ${m.tokens}`,
      `# HELP vane_alerts_active Active alerts`,
      `# TYPE vane_alerts_active gauge`,
      `vane_alerts_active ${m.alerts}`,
    ].join("\n"),
  );
});

app.get("/v1/search", (req, res) => {
  const q = String(req.query.q ?? "");
  res.json({ results: search(q) });
});

app.get("/v1/radar", (_req, res) => {
  res.json({ items: listRadar() });
});

app.get("/v1/tokens/:address", async (req, res) => {
  const token = await getTokenCached(req.params.address);
  if (!token) return res.status(404).json({ error: "Token not found" });
  res.json(token);
});

app.get("/v1/tokens/:address/graph", (req, res) => {
  const graph = getGraph(req.params.address);
  if (!graph) return res.status(404).json({ error: "Graph not found" });
  res.json(graph);
});

app.get("/v1/wallets/:address", (req, res) => {
  const wallet = getWallet(req.params.address);
  if (!wallet) return res.status(404).json({ error: "Wallet not found" });
  res.json(wallet);
});

app.post("/v1/agent", async (req, res) => {
  const question = String(req.body?.question ?? "");
  const focusToken = req.body?.tokenAddress as string | undefined;
  if (!question.trim()) return res.status(400).json({ error: "question required" });

  let answer = runAgent(
    question,
    {
      getToken,
      getWallet,
      webUrl,
    },
    focusToken,
  );
  answer = await maybePolishWithLlm(
    answer,
    process.env.OPENAI_API_KEY,
    process.env.OPENAI_MODEL,
  );
  res.json(answer);
});

app.post("/v1/reports", (req, res) => {
  const tokenAddress = String(req.body?.tokenAddress ?? "");
  const report = createReport(tokenAddress);
  if (!report) return res.status(404).json({ error: "Token not found" });
  res.status(201).json({
    ...report,
    url: `${webUrl}/r/${report.id}`,
  });
});

app.get("/v1/reports/:id", (req, res) => {
  const report = getReport(req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found" });
  res.json(report);
});

app.post("/v1/alerts", (req, res) => {
  const kind = String(req.body?.kind ?? "cluster_sell");
  const alert = createAlert({
    kind,
    tokenAddress: req.body?.tokenAddress,
    telegramChatId: req.body?.telegramChatId
      ? String(req.body.telegramChatId)
      : undefined,
    rules: req.body?.rules ?? {},
  });
  res.status(201).json(alert);
});

app.get("/v1/alerts", (req, res) => {
  res.json({ items: listAlerts(req.query.chatId ? String(req.query.chatId) : undefined) });
});

app.post("/v1/alerts/evaluate", (_req, res) => {
  res.json({ fired: evaluateAlerts() });
});

app.listen(port, () => {
  console.log(`Vane API listening on :${port}`);
});
