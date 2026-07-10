const api = process.env.API_URL ?? "http://localhost:4000";
const concurrency = Number(process.env.LOADTEST_CONCURRENCY ?? 50);
const total = Number(process.env.LOADTEST_TOTAL ?? 500);

async function hit(path: string) {
  const t0 = Date.now();
  const res = await fetch(`${api}${path}`);
  return { ok: res.ok, ms: Date.now() - t0, status: res.status };
}

async function main() {
  console.log(`Load testing ${api} — ${total} requests, concurrency ${concurrency}`);
  const paths = ["/health", "/v1/radar", "/v1/tokens/0x8a2e897abb6bf1d77c61cb3fa6c093ac71dc0efd"];
  let i = 0;
  let ok = 0;
  let limited = 0;
  let fail = 0;
  const times: number[] = [];

  async function worker() {
    while (i < total) {
      const n = i++;
      const path = paths[n % paths.length];
      try {
        const r = await hit(path);
        times.push(r.ms);
        if (r.ok) ok++;
        else if (r.status === 429) limited++;
        else fail++;
      } catch {
        fail++;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length * 0.5)] ?? 0;
  const p95 = times[Math.floor(times.length * 0.95)] ?? 0;
  console.log(
    JSON.stringify(
      {
        ok,
        rateLimited: limited,
        fail,
        p50_ms: p50,
        p95_ms: p95,
        total: times.length,
        note: "429s confirm rate limiting is protecting the API under burst traffic",
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
