import {
  createPublicClient,
  http,
  webSocket,
  type Chain,
  type PublicClient,
  type Transport,
} from "viem";

export interface ChainAdapterConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  wssUrl?: string;
  explorerUrl: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
}

export const ROBINHOOD_MAINNET: ChainAdapterConfig = {
  chainId: 4663,
  name: "Robinhood Chain",
  rpcUrl: process.env.RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com",
  wssUrl: process.env.WSS_URL ?? "wss://feed.mainnet.chain.robinhood.com",
  explorerUrl: "https://robinhoodchain.blockscout.com",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
};

export function toViemChain(cfg: ChainAdapterConfig): Chain {
  return {
    id: cfg.chainId,
    name: cfg.name,
    nativeCurrency: cfg.nativeCurrency,
    rpcUrls: {
      default: { http: [cfg.rpcUrl], webSocket: cfg.wssUrl ? [cfg.wssUrl] : undefined },
    },
    blockExplorers: {
      default: { name: "Blockscout", url: cfg.explorerUrl },
    },
  };
}

export type ChainAdapter = {
  config: ChainAdapterConfig;
  client: PublicClient;
  createWsClient: () => PublicClient | null;
};

export function createRobinhoodAdapter(
  overrides: Partial<ChainAdapterConfig> = {},
): ChainAdapter {
  const config: ChainAdapterConfig = { ...ROBINHOOD_MAINNET, ...overrides };
  const chain = toViemChain(config);
  const client = createPublicClient({
    chain,
    transport: http(config.rpcUrl, { batch: true, retryCount: 3 }),
  });

  return {
    config,
    client: client as PublicClient,
    createWsClient: () => {
      if (!config.wssUrl) return null;
      try {
        return createPublicClient({
          chain,
          transport: webSocket(config.wssUrl, { reconnect: true }) as Transport,
        }) as PublicClient;
      } catch {
        return null;
      }
    },
  };
}

/** ERC-20 minimal ABI fragments used by indexer / scan */
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
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
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

export function explorerTokenUrl(address: string, cfg = ROBINHOOD_MAINNET): string {
  return `${cfg.explorerUrl}/token/${address}`;
}

export function explorerAddressUrl(address: string, cfg = ROBINHOOD_MAINNET): string {
  return `${cfg.explorerUrl}/address/${address}`;
}

export function explorerTxUrl(hash: string, cfg = ROBINHOOD_MAINNET): string {
  return `${cfg.explorerUrl}/tx/${hash}`;
}
