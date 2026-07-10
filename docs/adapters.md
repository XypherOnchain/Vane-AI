# Adding DEX and launchpad adapters

Vane never hardcodes protocol addresses in UI components.

## Steps

1. Confirm official contract addresses on Robinhood Chain (mainnet `4663` / testnet `46630`).
2. Insert a row into `integrations` (or add a migration) with factory/router addresses, start block, ABIs.
3. Implement `DexAdapter` or `LaunchpadAdapter` in `packages/dex-adapters` / `packages/launchpad-adapters`.
4. Add fixture transactions under `tests/fixtures/`.
5. Unit-test event parsers.
6. Backfill from `start_block`.
7. Compare calculated pool/token state against the protocol interface.
8. Enable behind a feature flag (`integrations.enabled = true`).
9. Monitor parser errors in admin / observability.

## Interface sketch

See plan §9 and package stubs in:

- `packages/dex-adapters`
- `packages/launchpad-adapters`
