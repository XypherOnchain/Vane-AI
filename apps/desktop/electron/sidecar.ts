import http from "node:http";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Lightweight local API sidecar for offline-ish workspace (repo listing, health).
 * Proxies debug calls to the cloud/local API when available.
 */
export function startLocalSidecar(opts: {
  port?: number;
  apiUrl: string;
}): { port: number; close: () => void } {
  const port = opts.port ?? Number(process.env.VANE_SIDECAR_PORT ?? 4010);
  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);

    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          service: "vane-desktop-sidecar",
          modeBanner: ["simulation", "testnet", "live"],
          liveEnabled: false,
        }),
      );
      return;
    }

    if (url.pathname === "/local/list-dir") {
      const dir = url.searchParams.get("path") ?? "";
      if (!dir || !existsSync(dir)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "path required / missing" }));
        return;
      }
      try {
        const entries = readdirSync(dir)
          .slice(0, 200)
          .map((name) => {
            const full = path.join(dir, name);
            const st = statSync(full);
            return { name, dir: st.isDirectory(), size: st.size };
          });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ path: dir, entries }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
      }
      return;
    }

    // Proxy /v1/* to API
    if (url.pathname.startsWith("/v1/")) {
      try {
        const target = `${opts.apiUrl}${url.pathname}${url.search}`;
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const body = Buffer.concat(chunks);
        const upstream = await fetch(target, {
          method: req.method,
          headers: { "Content-Type": "application/json" },
          body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
        });
        const text = await upstream.text();
        res.writeHead(upstream.status, { "Content-Type": "application/json" });
        res.end(text);
      } catch (e) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "API unreachable — sidecar local-only mode",
            message: e instanceof Error ? e.message : String(e),
          }),
        );
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  server.listen(port, "127.0.0.1");
  console.log(`[vane-sidecar] http://127.0.0.1:${port}`);
  return {
    port,
    close: () => server.close(),
  };
}
