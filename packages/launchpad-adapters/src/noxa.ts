import { getIntegration } from "@vane/chain";
import type {
  ChainLog,
  GraduationEvent,
  LaunchCompletedEvent,
  LaunchpadAdapter,
  TokenCreatedEvent,
} from "./types.js";

/**
 * NOXA Fun launchpad adapter (fun.noxa.fi/robinhood).
 *
 * The LaunchFactory source is NOT verified on Blockscout, so this decoder is
 * built from the observed on-chain layout of live launch transactions (e.g.
 * 0x63458680bc7efe6ff9c5376b51626974bc031ff18c80baeee1a65dd49555317b):
 *
 *   TokenCreated  topic0 0x14613701… — topics: token, creator, dexFactory;
 *                 data word 0 = quote token (WETH).
 *   TokenLaunched topic0 0xdb51ea9a… — same topics; data words:
 *                 [quoteToken, pool, …unlabeled values kept as raw evidence].
 *
 * Only fields whose meaning we have confirmed against the paired Uniswap V3
 * PoolCreated log in the same transaction are decoded into named fields.
 */
export const NOXA_TOPICS = {
  tokenCreated: "0x1461370115e1c2be79cb529f8cfcbd11316e789d9c6099fc83417b0b4c48c62a",
  tokenLaunched: "0xdb51ea9ad51ab453a65a4cb7e60c3cb378c9501bb002609f8f97778fb6c4235a",
} as const;

function lower(a: string): `0x${string}` {
  return a.toLowerCase() as `0x${string}`;
}

function topicToAddress(topic: `0x${string}`): `0x${string}` {
  return `0x${topic.slice(26)}` as `0x${string}`;
}

function dataWords(data: `0x${string}`): `0x${string}`[] {
  const body = data.slice(2);
  const words: `0x${string}`[] = [];
  for (let i = 0; i < body.length; i += 64) {
    words.push(`0x${body.slice(i, i + 64)}` as `0x${string}`);
  }
  return words;
}

function wordToAddress(word: `0x${string}`): `0x${string}` {
  return `0x${word.slice(26)}` as `0x${string}`;
}

export function createNoxaAdapter(): LaunchpadAdapter {
  const integration = getIntegration("noxa");
  if (!integration) throw new Error("noxa missing from integration registry");
  const factory = integration.contracts.find((c) => c.name === "LaunchFactory");
  if (!factory) throw new Error("noxa registry entry has no LaunchFactory contract");
  const factoryAddress = lower(factory.address);

  return {
    id: "noxa",
    startBlock: integration.startBlock,
    supportedContracts: [factoryAddress],

    decodeTokenCreated(log: ChainLog): TokenCreatedEvent | null {
      if (lower(log.address) !== factoryAddress) return null;
      if (log.topics[0] !== NOXA_TOPICS.tokenCreated) return null;
      if (log.topics.length < 4) return null;
      const words = dataWords(log.data);
      if (words.length < 1) return null;
      return {
        kind: "token_created",
        launchpadId: "noxa",
        token: lower(topicToAddress(log.topics[1]!)),
        creator: lower(topicToAddress(log.topics[2]!)),
        dexFactory: lower(topicToAddress(log.topics[3]!)),
        quoteToken: lower(wordToAddress(words[0]!)),
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
      };
    },

    decodeLaunchCompleted(log: ChainLog): LaunchCompletedEvent | null {
      if (lower(log.address) !== factoryAddress) return null;
      if (log.topics[0] !== NOXA_TOPICS.tokenLaunched) return null;
      if (log.topics.length < 4) return null;
      const words = dataWords(log.data);
      if (words.length < 2) return null;
      return {
        kind: "launch_completed",
        launchpadId: "noxa",
        token: lower(topicToAddress(log.topics[1]!)),
        creator: lower(topicToAddress(log.topics[2]!)),
        dexFactory: lower(topicToAddress(log.topics[3]!)),
        quoteToken: lower(wordToAddress(words[0]!)),
        pool: lower(wordToAddress(words[1]!)),
        rawDataWords: words.slice(2),
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
      };
    },

    // NOXA graduation is a milestone (no LP migration), and we have not yet
    // observed and confirmed a distinct graduation event on-chain. Returning
    // null is the honest behavior until a fixture exists.
    decodeGraduation(_log: ChainLog): GraduationEvent | null {
      return null;
    },
  };
}
