import {
  createPublicClient,
  http,
  webSocket,
  type Chain,
  type PublicClient,
  type Transport,
  type Hex,
} from "viem";
import type { VaneEnv } from "@vane/config";

export * from "./integrations.js";

export interface NetworkConfig {
  id: "robinhood-mainnet" | "robinhood-testnet";
  chainId: number;
  name: string;
  rpcUrl: string;
  rpcBackupUrl?: string;
  wssUrl?: string;
  explorerUrl: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
}

const PUBLIC_RPC = {
  mainnet: "https://rpc.mainnet.chain.robinhood.com",
  testnet: "https://rpc.testnet.chain.robinhood.com",
} as const;

export function getNetworkConfig(
  env: VaneEnv,
  which: "mainnet" | "testnet" = env.ACTIVE_CHAIN,
): NetworkConfig {
  // env.rpc is resolved for the ACTIVE_CHAIN with strict production validation
  // already applied by @vane/config. Legacy per-network variables remain as a
  // development fallback when explicitly targeting the other network.
  const isActive = which === env.ACTIVE_CHAIN;
  if (which === "testnet") {
    return {
      id: "robinhood-testnet",
      chainId: 46630,
      name: "Robinhood Chain Testnet",
      rpcUrl: (isActive ? env.rpc.primary : env.ROBINHOOD_TESTNET_RPC_URL) ?? PUBLIC_RPC.testnet,
      rpcBackupUrl: isActive ? env.rpc.backup : env.ROBINHOOD_TESTNET_RPC_BACKUP_URL,
      wssUrl: isActive ? env.rpc.wsPrimary : env.ROBINHOOD_TESTNET_WS_URL,
      explorerUrl: "https://explorer.testnet.chain.robinhood.com",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    };
  }
  return {
    id: "robinhood-mainnet",
    chainId: 4663,
    name: "Robinhood Chain",
    rpcUrl: (isActive ? env.rpc.primary : env.ROBINHOOD_MAINNET_RPC_URL) ?? PUBLIC_RPC.mainnet,
    rpcBackupUrl: isActive ? env.rpc.backup : env.ROBINHOOD_MAINNET_RPC_BACKUP_URL,
    wssUrl: isActive ? env.rpc.wsPrimary : env.ROBINHOOD_MAINNET_WS_URL,
    explorerUrl: "https://robinhoodchain.blockscout.com",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  };
}

export function toViemChain(cfg: NetworkConfig): Chain {
  return {
    id: cfg.chainId,
    name: cfg.name,
    nativeCurrency: cfg.nativeCurrency,
    rpcUrls: {
      default: {
        http: [cfg.rpcUrl, ...(cfg.rpcBackupUrl ? [cfg.rpcBackupUrl] : [])],
        webSocket: cfg.wssUrl ? [cfg.wssUrl] : undefined,
      },
    },
    blockExplorers: {
      default: { name: "Blockscout", url: cfg.explorerUrl },
    },
    contracts: {
      // Canonical Multicall3 (bytecode-verified in the integration registry) —
      // lets viem batch many reads into one eth_call, which matters on the
      // rate-limited public RPC.
      multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
    },
  };
}

export type ProviderHealth = {
  primaryOk: boolean;
  backupOk: boolean;
  tipBlock: string | null;
  latencyMs: number | null;
  error?: string;
};

/** HTTP provider with primary → backup failover */
export class RpcProvider {
  readonly config: NetworkConfig;
  private primary: PublicClient;
  private backup: PublicClient | null;

  constructor(config: NetworkConfig) {
    this.config = config;
    const chain = toViemChain(config);
    this.primary = createPublicClient({
      chain,
      transport: http(config.rpcUrl, { batch: true, retryCount: 2, timeout: 12_000 }),
    }) as PublicClient;
    this.backup = config.rpcBackupUrl
      ? (createPublicClient({
          chain,
          transport: http(config.rpcBackupUrl, { batch: true, retryCount: 2, timeout: 12_000 }),
        }) as PublicClient)
      : null;
  }

  async withClient<T>(fn: (client: PublicClient) => Promise<T>): Promise<T> {
    try {
      return await fn(this.primary);
    } catch (primaryErr) {
      if (!this.backup) throw primaryErr;
      return await fn(this.backup);
    }
  }

  getBlockNumber() {
    return this.withClient((c) => c.getBlockNumber());
  }

  getBlock(args: { blockNumber: bigint; includeTransactions?: boolean }) {
    return this.withClient((c) => c.getBlock(args));
  }

  getTransactionReceipt(hash: Hex) {
    return this.withClient((c) => c.getTransactionReceipt({ hash }));
  }

  getLogs(...args: Parameters<PublicClient["getLogs"]>) {
    return this.withClient((c) => c.getLogs(...args));
  }

  readContract(...args: Parameters<PublicClient["readContract"]>) {
    return this.withClient((c) => c.readContract(...args));
  }

  multicall(...args: Parameters<PublicClient["multicall"]>) {
    return this.withClient((c) => c.multicall(...args));
  }

  createWsClient(): PublicClient | null {
    if (!this.config.wssUrl) return null;
    try {
      return createPublicClient({
        chain: toViemChain(this.config),
        transport: webSocket(this.config.wssUrl, { reconnect: true }) as Transport,
      }) as PublicClient;
    } catch {
      return null;
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    const t0 = Date.now();
    let primaryOk = false;
    let backupOk = false;
    let tipBlock: string | null = null;
    let error: string | undefined;
    try {
      tipBlock = (await this.primary.getBlockNumber()).toString();
      primaryOk = true;
    } catch (e) {
      error = (e as Error).message;
    }
    if (this.backup) {
      try {
        const tip = await this.backup.getBlockNumber();
        backupOk = true;
        if (tipBlock == null) tipBlock = tip.toString();
      } catch {
        /* ignore */
      }
    }
    return {
      primaryOk,
      backupOk,
      tipBlock,
      latencyMs: primaryOk || backupOk ? Date.now() - t0 : null,
      error,
    };
  }
}

export function createRobinhoodProvider(env: VaneEnv, which?: "mainnet" | "testnet") {
  return new RpcProvider(getNetworkConfig(env, which));
}

export const erc20Abi = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const;

export function normalizeAddress(addr: string): string {
  return addr.toLowerCase();
}

export function explorerTokenUrl(address: string, cfg: NetworkConfig): string {
  return `${cfg.explorerUrl}/token/${address}`;
}

export function explorerTxUrl(hash: string, cfg: NetworkConfig): string {
  return `${cfg.explorerUrl}/tx/${hash}`;
}

export function explorerAddressUrl(address: string, cfg: NetworkConfig): string {
  return `${cfg.explorerUrl}/address/${address}`;
}
