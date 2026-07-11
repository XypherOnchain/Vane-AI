import type { ChainLog } from "@vane/dex-adapters";

export type { ChainLog };

export interface TokenCreatedEvent {
  kind: "token_created";
  launchpadId: string;
  token: `0x${string}`;
  creator: `0x${string}`;
  /** DEX factory the launchpad targets for the trading pool. */
  dexFactory: `0x${string}`;
  quoteToken: `0x${string}`;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
}

export interface LaunchCompletedEvent {
  kind: "launch_completed";
  launchpadId: string;
  token: `0x${string}`;
  creator: `0x${string}`;
  dexFactory: `0x${string}`;
  quoteToken: `0x${string}`;
  pool: `0x${string}`;
  /**
   * Raw undecoded data words retained as evidence. The NOXA factory source is
   * not verified on Blockscout, so unnamed values are never presented as facts.
   */
  rawDataWords: `0x${string}`[];
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
}

export interface GraduationEvent {
  kind: "graduation";
  launchpadId: string;
  token: `0x${string}`;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
}

/** Contract every launchpad adapter must fulfil. Decoders return null for foreign logs. */
export interface LaunchpadAdapter {
  id: string;
  startBlock: bigint;
  supportedContracts: `0x${string}`[];

  decodeTokenCreated(log: ChainLog): TokenCreatedEvent | null;
  decodeLaunchCompleted(log: ChainLog): LaunchCompletedEvent | null;
  decodeGraduation(log: ChainLog): GraduationEvent | null;
}
