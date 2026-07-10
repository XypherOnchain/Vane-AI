import { createRobinhoodAdapter, erc20Abi } from "@vane/chain";
import { Redis } from "ioredis";
import pg from "pg";

const POLL_MS = Number(process.env.INDEXER_POLL_MS ?? 4000);
const WORKERS = Number(process.env.INDEXER_WORKERS ?? 2);

const adapter = createRobinhoodAdapter({
  rpcUrl: process.env.RPC_URL,
  wssUrl: process.env.WSS_URL,
  chainId: Number(process.env.CHAIN_ID ?? 4663),
});

let pool: pg.Pool | null = null;
let redis: InstanceType<typeof Redis> | null = null;

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  return pool;
}

function getRedis() {
  if (!process.env.REDIS_URL) return null;
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
    void redis.connect().catch(() => {
      redis = null;
    });
  }
  return redis;
}

async function getCursor(): Promise<bigint> {
  const p = getPool();
  if (p) {
    try {
      const r = await p.query(`SELECT value FROM indexer_state WHERE key = 'last_block'`);
      if (r.rows[0]) return BigInt(r.rows[0].value);
    } catch {
      /* schema may not be up */
    }
  }
  const r = getRedis();
  if (r) {
    try {
      const v = await r.get("vane:indexer:last_block");
      if (v) return BigInt(v);
    } catch {
      /* ignore */
    }
  }
  try {
    const tip = await adapter.client.getBlockNumber();
    return tip > 5n ? tip - 5n : tip;
  } catch {
    return 0n;
  }
}

async function setCursor(block: bigint) {
  const p = getPool();
  if (p) {
    try {
      await p.query(
        `INSERT INTO indexer_state(key, value, updated_at) VALUES('last_block', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [block.toString()],
      );
    } catch {
      /* ignore */
    }
  }
  const r = getRedis();
  if (r) {
    try {
      await r.set("vane:indexer:last_block", block.toString());
      await r.publish(
        "vane:indexer",
        JSON.stringify({ type: "cursor", block: block.toString() }),
      );
    } catch {
      /* ignore */
    }
  }
}

async function indexBlock(blockNumber: bigint, workerId: number) {
  try {
    const block = await adapter.client.getBlock({ blockNumber, includeTransactions: true });
    const deployments: string[] = [];
    for (const tx of block.transactions) {
      if (typeof tx === "string") continue;
      if (tx.to == null && tx.input && tx.input !== "0x") {
        // contract creation — receipt needed for address; best-effort
        try {
          const receipt = await adapter.client.getTransactionReceipt({ hash: tx.hash });
          if (receipt.contractAddress) {
            deployments.push(receipt.contractAddress.toLowerCase());
            await upsertTokenStub(receipt.contractAddress, tx.from, blockNumber);
          }
        } catch {
          /* rate limit / missing */
        }
      }
    }

    // Sample Transfer logs for known activity (bounded for public RPC)
    try {
      const logs = await adapter.client.getLogs({
        fromBlock: blockNumber,
        toBlock: blockNumber,
        events: [
          {
            type: "event",
            name: "Transfer",
            inputs: [
              { name: "from", type: "address", indexed: true },
              { name: "to", type: "address", indexed: true },
              { name: "value", type: "uint256", indexed: false },
            ],
          },
        ],
      });
      if (logs.length > 0) {
        console.log(
          `[worker ${workerId}] block ${blockNumber} txs=${block.transactions.length} transfers=${logs.length} deploys=${deployments.length}`,
        );
      } else if (Number(blockNumber) % 20 === 0) {
        console.log(
          `[worker ${workerId}] block ${blockNumber} txs=${block.transactions.length} (heartbeat)`,
        );
      }
    } catch {
      if (Number(blockNumber) % 20 === 0) {
        console.log(`[worker ${workerId}] block ${blockNumber} (logs skipped)`);
      }
    }
  } catch (e) {
    console.warn(`[worker ${workerId}] failed block ${blockNumber}`, (e as Error).message);
  }
}

async function upsertTokenStub(address: string, deployer: string, block: bigint) {
  const p = getPool();
  let name = "Unknown";
  let symbol = "???";
  let decimals = 18;
  try {
    const results = await Promise.allSettled([
      adapter.client.readContract({ address: address as `0x${string}`, abi: erc20Abi, functionName: "name" }),
      adapter.client.readContract({ address: address as `0x${string}`, abi: erc20Abi, functionName: "symbol" }),
      adapter.client.readContract({ address: address as `0x${string}`, abi: erc20Abi, functionName: "decimals" }),
    ]);
    if (results[0].status === "fulfilled") name = String(results[0].value);
    if (results[1].status === "fulfilled") symbol = String(results[1].value);
    if (results[2].status === "fulfilled") decimals = Number(results[2].value);
  } catch {
    /* not erc20 */
  }

  if (p) {
    try {
      await p.query(
        `INSERT INTO tokens(address, chain_id, name, symbol, decimals, deployer, created_at_block, updated_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,NOW())
         ON CONFLICT (address) DO UPDATE SET updated_at = NOW()`,
        [address.toLowerCase(), adapter.config.chainId, name, symbol, decimals, deployer.toLowerCase(), block.toString()],
      );
      await p.query(
        `INSERT INTO radar_events(kind, token_address, payload) VALUES('new_token', $1, $2)`,
        [address.toLowerCase(), JSON.stringify({ name, symbol, deployer, block: block.toString() })],
      );
    } catch {
      /* ignore */
    }
  }

  const r = getRedis();
  if (r) {
    try {
      await r.publish(
        "vane:radar",
        JSON.stringify({ kind: "new_token", address, name, symbol, deployer }),
      );
    } catch {
      /* ignore */
    }
  }
  console.log(`[indexer] new token ${symbol} ${address}`);
}

async function workerLoop(workerId: number) {
  for (;;) {
    try {
      const tip = await adapter.client.getBlockNumber();
      let cursor = await getCursor();
      // shard by worker for horizontal scale
      while (cursor < tip) {
        const next = cursor + 1n;
        if (Number(next) % WORKERS === workerId) {
          await indexBlock(next, workerId);
        }
        cursor = next;
        if (Number(next) % WORKERS === 0) await setCursor(next);
      }
      await setCursor(tip);
    } catch (e) {
      console.warn(`[worker ${workerId}] loop error`, (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

async function main() {
  console.log(
    `Vane indexer starting — chain ${adapter.config.chainId} rpc=${adapter.config.rpcUrl} workers=${WORKERS}`,
  );
  try {
    const tip = await adapter.client.getBlockNumber();
    console.log(`Connected. Tip block ${tip}`);
  } catch (e) {
    console.warn("RPC unreachable at boot; will retry.", (e as Error).message);
  }

  await Promise.all(Array.from({ length: WORKERS }, (_, i) => workerLoop(i)));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
