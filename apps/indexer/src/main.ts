import { loadEnv } from "@vane/config";
import { createRobinhoodProvider, erc20Abi, normalizeAddress } from "@vane/chain";
import { Redis } from "ioredis";
import pg from "pg";
import type { Hex } from "viem";
import { runIntegrationsWatcher } from "./integrations-watcher.js";

const env = loadEnv();
const POLL_MS = env.INDEXER_POLL_MS;
const WORKERS = env.INDEXER_WORKERS;
const provider = createRobinhoodProvider(env);

let pool: pg.Pool | null = null;
let redis: InstanceType<typeof Redis> | null = null;

function getPool() {
  if (!pool) {
    // Strict production validation in @vane/config guarantees DATABASE_URL there;
    // in development we fall back to the local docker-compose instance.
    const connectionString = env.DATABASE_URL ?? "postgresql://vane:vane@localhost:5432/vane";
    pool = new pg.Pool({ connectionString, max: 10 });
  }
  return pool;
}

function getRedis() {
  if (!redis) {
    if (!env.REDIS_URL) return null;
    try {
      redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
      void redis.connect().catch(() => {
        redis = null;
      });
    } catch {
      redis = null;
    }
  }
  return redis;
}

async function getCursor(): Promise<bigint> {
  try {
    const r = await getPool().query(
      `SELECT last_processed_block FROM checkpoints WHERE service_name = 'indexer' AND chain_id = $1`,
      [provider.config.chainId],
    );
    if (r.rows[0]) return BigInt(r.rows[0].last_processed_block);
  } catch {
    /* schema may be missing until docker init */
  }
  try {
    const tip = await provider.getBlockNumber();
    return tip > 5n ? tip - 5n : tip;
  } catch {
    return 0n;
  }
}

async function setCursor(block: bigint) {
  try {
    await getPool().query(
      `INSERT INTO checkpoints(service_name, chain_id, last_received_block, last_processed_block, last_finalized_block, updated_at)
       VALUES('indexer', $1, $2, $2, $2, NOW())
       ON CONFLICT (service_name, chain_id) DO UPDATE SET
         last_received_block = EXCLUDED.last_received_block,
         last_processed_block = EXCLUDED.last_processed_block,
         updated_at = NOW()`,
      [provider.config.chainId, block.toString()],
    );
  } catch {
    /* ignore */
  }
  const r = getRedis();
  if (r) {
    try {
      await r.set(`vane:indexer:${provider.config.chainId}:last_block`, block.toString());
    } catch {
      /* ignore */
    }
  }
}

async function indexBlock(blockNumber: bigint, workerId: number) {
  try {
    const block = await provider.getBlock({ blockNumber, includeTransactions: true });
    try {
      await getPool().query(
        `INSERT INTO blocks(chain_id, block_number, block_hash, parent_hash, timestamp, status)
         VALUES($1,$2,$3,$4,to_timestamp($5), 'ingested')
         ON CONFLICT (chain_id, block_number) DO NOTHING`,
        [
          provider.config.chainId,
          blockNumber.toString(),
          block.hash,
          block.parentHash,
          Number(block.timestamp),
        ],
      );
    } catch {
      /* db optional at boot */
    }

    for (const tx of block.transactions) {
      if (typeof tx === "string") continue;
      if (tx.to == null && tx.input && tx.input !== "0x") {
        try {
          const receipt = await provider.getTransactionReceipt(tx.hash as Hex);
          if (receipt.contractAddress) {
            const address = normalizeAddress(receipt.contractAddress);
            let name = "Unknown";
            let symbol = "???";
            let decimals = 18;
            try {
              const results = await Promise.allSettled([
                provider.readContract({
                  address: receipt.contractAddress,
                  abi: erc20Abi,
                  functionName: "name",
                }),
                provider.readContract({
                  address: receipt.contractAddress,
                  abi: erc20Abi,
                  functionName: "symbol",
                }),
                provider.readContract({
                  address: receipt.contractAddress,
                  abi: erc20Abi,
                  functionName: "decimals",
                }),
              ]);
              if (results[0].status === "fulfilled") name = String(results[0].value);
              if (results[1].status === "fulfilled") symbol = String(results[1].value);
              if (results[2].status === "fulfilled") decimals = Number(results[2].value);
            } catch {
              /* not erc20 */
            }
            try {
              await getPool().query(
                `INSERT INTO tokens(chain_id, address, name, symbol, decimals, deployer_address, created_block, processing_state)
                 VALUES($1,$2,$3,$4,$5,$6,$7,'DETECTED')
                 ON CONFLICT (chain_id, address) DO UPDATE SET processing_state = tokens.processing_state`,
                [
                  provider.config.chainId,
                  address,
                  name,
                  symbol,
                  decimals,
                  normalizeAddress(tx.from),
                  blockNumber.toString(),
                ],
              );
            } catch {
              /* ignore */
            }
            console.log(`[indexer] token ${symbol} ${address}`);
          }
        } catch {
          /* rate limit */
        }
      }
    }

    if (Number(blockNumber) % 25 === 0) {
      console.log(`[worker ${workerId}] block ${blockNumber} txs=${block.transactions.length}`);
    }
  } catch (e) {
    console.warn(`[worker ${workerId}] failed block ${blockNumber}`, (e as Error).message);
  }
}

async function workerLoop(workerId: number) {
  for (;;) {
    try {
      const tip = await provider.getBlockNumber();
      let cursor = await getCursor();
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
    `Vane indexer — chain ${provider.config.chainId} rpc=${provider.config.rpcUrl} workers=${WORKERS}`,
  );
  const health = await provider.healthCheck();
  console.log("Provider health", health);
  await Promise.all([
    ...Array.from({ length: WORKERS }, (_, i) => workerLoop(i)),
    runIntegrationsWatcher({ provider, getPool, pollMs: POLL_MS }),
  ]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
