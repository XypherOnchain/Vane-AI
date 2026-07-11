export type {
  ChainLog,
  GraduationEvent,
  LaunchCompletedEvent,
  LaunchpadAdapter,
  TokenCreatedEvent,
} from "./types.js";
export { createNoxaAdapter, NOXA_TOPICS } from "./noxa.js";

import type { LaunchpadAdapter } from "./types.js";
import { createNoxaAdapter } from "./noxa.js";

/**
 * All launchpad adapters that are implemented AND enabled in the registry.
 * hood.fun is registered but disabled until its contract addresses are
 * published and verified — Vane never guesses protocol addresses.
 */
export function enabledLaunchpadAdapters(): LaunchpadAdapter[] {
  return [createNoxaAdapter()];
}
