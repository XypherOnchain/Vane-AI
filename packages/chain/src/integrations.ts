/**
 * Versioned integration registry for Robinhood Chain (chain ID 4663).
 *
 * Every address here was verified on 2026-07-10 by checking live bytecode via
 * eth_getCode against the public RPC. Sources are recorded per integration.
 * Protocol addresses must come from this registry — never scatter them
 * through application code.
 */

export const INTEGRATION_REGISTRY_VERSION = "2026-07-10.1";

export type IntegrationKind = "dex" | "launchpad" | "infrastructure";

export interface IntegrationContract {
  name: string;
  address: `0x${string}`;
  /** true = we confirmed live bytecode at this address via eth_getCode */
  bytecodeVerified: boolean;
}

export interface IntegrationEntry {
  id: string;
  displayName: string;
  kind: IntegrationKind;
  chainId: number;
  /** false = registered but must not produce data yet (addresses unconfirmed, adapter untested) */
  enabled: boolean;
  contracts: IntegrationContract[];
  /** Earliest block worth scanning. Robinhood Chain mainnet launched 2026-07-01. */
  startBlock: bigint;
  /** Where the addresses came from, for auditability. */
  sources: string[];
  notes?: string;
}

const CHAIN_ID = 4663;

/** Robinhood Chain mainnet genesis era — chain launched 2026-07-01. */
const MAINNET_START = 0n;

export const ROBINHOOD_INTEGRATIONS: IntegrationEntry[] = [
  {
    id: "uniswap-v3",
    displayName: "Uniswap V3",
    kind: "dex",
    chainId: CHAIN_ID,
    enabled: true,
    startBlock: MAINNET_START,
    contracts: [
      {
        name: "V3Factory",
        address: "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA",
        bytecodeVerified: true,
      },
      {
        name: "NonfungiblePositionManager",
        address: "0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3",
        bytecodeVerified: true,
      },
      {
        name: "UniversalRouterV2_0",
        address: "0x53BF6B0684Ec7eF91e1387Da3D1a1769bC5A6F77",
        bytecodeVerified: true,
      },
    ],
    sources: [
      "https://github.com/Uniswap/contracts/pull/138 (official deployment PR, constructor args)",
      "eth_getCode verified 2026-07-10",
    ],
    notes:
      "Primary public AMM on Robinhood Chain. NOXA launches pair against WETH in the 1% fee tier.",
  },
  {
    id: "uniswap-v2",
    displayName: "Uniswap V2",
    kind: "dex",
    chainId: CHAIN_ID,
    enabled: false,
    startBlock: MAINNET_START,
    contracts: [
      {
        name: "V2Factory",
        address: "0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f",
        bytecodeVerified: true,
      },
    ],
    sources: ["https://github.com/Uniswap/contracts/pull/138", "eth_getCode verified 2026-07-10"],
    notes: "Deployed; adapter not yet built. Enable once decoding fixtures exist.",
  },
  {
    id: "uniswap-v4",
    displayName: "Uniswap V4",
    kind: "dex",
    chainId: CHAIN_ID,
    enabled: false,
    startBlock: MAINNET_START,
    contracts: [
      {
        name: "PoolManager",
        address: "0x8366a39CC670B4001A1121B8F6A443A643e40951",
        bytecodeVerified: true,
      },
      {
        name: "V4PositionManager",
        address: "0x58daec3116aae6D93017bAAea7749052E8a04fA7",
        bytecodeVerified: true,
      },
    ],
    sources: ["https://github.com/Uniswap/contracts/pull/138", "eth_getCode verified 2026-07-10"],
    notes: "Deployed; adapter not yet built (singleton pool model needs its own decoder).",
  },
  {
    id: "noxa",
    displayName: "NOXA Fun",
    kind: "launchpad",
    chainId: CHAIN_ID,
    enabled: true,
    startBlock: MAINNET_START,
    contracts: [
      {
        name: "LaunchFactory",
        address: "0xD9eC2db5f3D1b236843925949fe5bd8a3836FCcB",
        bytecodeVerified: true,
      },
      {
        name: "LaunchLocker",
        address: "0x7F03effbd7ceB22A3f80Dd468f67eF27826acD85",
        bytecodeVerified: true,
      },
    ],
    sources: [
      "https://docs.noxa.fi/contracts/noxa-fun/ (official docs)",
      "eth_getCode verified 2026-07-10",
      "event layout confirmed from live launch tx 0x63458680bc7efe6ff9c5376b51626974bc031ff18c80baeee1a65dd49555317b",
    ],
    notes:
      "Dominant launchpad on Robinhood Chain (9 of top 10 tokens). Launches mint an ERC-20 and " +
      "create a Uniswap V3 1% WETH pool in the same transaction; LP locked in LaunchLocker. " +
      "Factory source is NOT verified on Blockscout — event decoding is from observed on-chain layout.",
  },
  {
    id: "hood-fun",
    displayName: "hood.fun",
    kind: "launchpad",
    chainId: CHAIN_ID,
    enabled: false,
    startBlock: MAINNET_START,
    contracts: [],
    sources: ["https://hood.fun (launched 2026-07-09, press release via GlobeNewswire)"],
    notes:
      "Bonding-curve launchpad with automated Uniswap V3 graduation and permanent LP lock. " +
      "No contract addresses published yet — DISABLED until addresses are verified on-chain. " +
      "Vane never guesses protocol addresses.",
  },
  {
    id: "rialto",
    displayName: "Rialto",
    kind: "dex",
    chainId: CHAIN_ID,
    enabled: false,
    startBlock: MAINNET_START,
    contracts: [],
    sources: ["https://docs.robinhood.com/chain/ (listed as PropAMM/aggregator partner)"],
    notes: "Official PropAMM spot venue. Addresses not published; disabled until verified.",
  },
  {
    id: "wrapped-native",
    displayName: "WETH (canonical)",
    kind: "infrastructure",
    chainId: CHAIN_ID,
    enabled: true,
    startBlock: MAINNET_START,
    contracts: [
      {
        name: "WETH9",
        address: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
        bytecodeVerified: true,
      },
    ],
    sources: [
      "Uniswap deployment PR constructor args + NOXA docs agree",
      "eth_getCode verified 2026-07-10",
    ],
  },
  {
    id: "known-infrastructure",
    displayName: "Known infrastructure (cluster suppression)",
    kind: "infrastructure",
    chainId: CHAIN_ID,
    enabled: true,
    startBlock: MAINNET_START,
    contracts: [
      {
        name: "Permit2",
        address: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
        bytecodeVerified: true,
      },
      {
        name: "Multicall3",
        address: "0xcA11bde05977b3631167028862bE2a173976CA11",
        bytecodeVerified: true,
      },
      {
        name: "L2Multicall",
        address: "0x2cAC2D899eCC914d704FeaAE33ac1bF36277DaD1",
        bytecodeVerified: false,
      },
    ],
    sources: [
      "https://docs.robinhood.com/chain/protocol-contracts/",
      "eth_getCode verified 2026-07-10 (Permit2, Multicall3)",
    ],
    notes: "These addresses must never be clustered as wallets in graph analysis.",
  },
];

export function getIntegration(id: string): IntegrationEntry | undefined {
  return ROBINHOOD_INTEGRATIONS.find((i) => i.id === id);
}

export function enabledIntegrations(kind?: IntegrationKind): IntegrationEntry[] {
  return ROBINHOOD_INTEGRATIONS.filter((i) => i.enabled && (!kind || i.kind === kind));
}

/** All addresses the indexer should subscribe to for log ingestion. */
export function watchedAddresses(): `0x${string}`[] {
  return enabledIntegrations()
    .filter((i) => i.kind !== "infrastructure")
    .flatMap((i) => i.contracts.map((c) => c.address));
}

/** Addresses that graph/cluster analysis must treat as known services, never wallets. */
export function knownServiceAddresses(): Set<string> {
  const set = new Set<string>();
  for (const i of ROBINHOOD_INTEGRATIONS) {
    for (const c of i.contracts) set.add(c.address.toLowerCase());
  }
  return set;
}
