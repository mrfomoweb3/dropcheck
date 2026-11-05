# Evidence ledger

Status: **verified** = we ran it on V3 · **from docs** = cited source · **assumption** = not yet proven.

| Claim | Source | Date | Status |
|---|---|---|---|
| Substrate WSS `wss://test-node-v3.portaldot.dev` is live | `spike/connect.ts` → `docs/spike-connect.log` | 2026-10-26 | verified |
| Genesis `0xd4f9acbc…5283bd`, spec `portaldot-v3`/3002, 69 pallets | spike-connect.log | 2026-10-26 | verified |
| EVM RPC live, chain id 420420777 (`0x190f1ca9`) | `curl eth_chainId` | 2026-10-26 | verified |
| Token symbol is `tPOT` (guide says `tPOTv3`), 14 decimals, ss58 42 | `system_properties` | 2026-10-26 | verified |
| Existential deposit = 0.1 tPOT (10^13 planck) | `consts.balances.existentialDeposit` | 2026-10-26 | verified |
| `Balances.transfer` absent; `transferKeepAlive`/`transferAllowDeath` present | metadata | 2026-10-26 | verified |
| `Utility.batchAll` present; `batchedCallsLimit` = 10,922 | metadata/consts | 2026-10-26 | verified |
| `system_dryRun` RPC exposed | `rpc_methods` | 2026-10-26 | verified |
| H160 `0xf7eC…4142` → `5Hfmuhj1…to8Y` via `ReviveApi.account_id` and via fallback | spike-connect.log, `tests/unit/address.test.ts` | 2026-10-26 | verified |
| `Revive.OriginalAccount(0xf7eC…)` is unset (fallback mapping applies) | spike-connect.log | 2026-10-26 | verified |
| All 21 existing assets on V3 are non-sufficient; `nextAssetId` unset | `spike/list-assets.ts` | 2026-10-26 | verified |
| Asset deposit 1 tPOT; asset account deposit 1 tPOT; metadata 0.1 + 0.06/byte | consts | 2026-10-26 | verified |
| Classifier output on live chain (asset 7777 pUSD, real holders + fresh + EVM + bad rows) | `scripts/run-demo-headless.ts` read-only run | 2026-10-26 | verified |
| `paymentInfo` fee for a 15-call batch ≈ 0.0731 tPOT | headless run | 2026-10-26 | verified |
| node-console is a polkadot.js Apps fork; link blocks via `#/explorer/query/<n>` | page HTML | 2026-10-26 | from page (link format **assumption** until clicked) |
| Old `*.feso-apps.xyz` endpoints are stale | build spec | — | from docs (not re-tested) |
| No public faucet; tPOT is distributed to registered participants / via Discord ticket | portaldot-v3-testnet-guide README | 2026-10-26 | from docs |
| Asset transfer to an account with no native balance fails with **`TokenError.CannotCreate`** | spike step 6a, `docs/spike-fork.log` | 2026-11-05 | verified on **V3 fork** (live: pending) |
| Transfer below `min_balance` to a new holder fails with `TokenError.BelowMinimum` | spike step 6b | 2026-11-05 | verified on **V3 fork** |
| Native transfer below ED to a new account fails with `TokenError.BelowMinimum` | spike step 6c | 2026-11-05 | verified on **V3 fork** |
| `batch_all(top-up, asset transfer)` makes a fresh account hold the asset | spike step 7 | 2026-11-05 | verified on **V3 fork**; **live V3 pending funding** |
| No ERC-20 assets precompile found on the EVM side (asset 7777, two standard address formats return `0x`) | `eth_call` on live EVM RPC | 2026-11-05 | verified (live V3) |
| 50-recipient batch (100 calls) is included in one block: 1.8% of block refTime, fee 0.436 tPOT | spike step 9 | 2026-11-05 | verified on **V3 fork** |
| Live test A5–A7: demo list → 1 signature → 17 asset transfers, 5 top-ups, 2 excluded, 1 merged; fresh accounts hold the asset; sender ≥ ED | `pnpm test:live` on fork | 2026-11-05 | verified on **V3 fork** (live: pending) |
| Browser UI end to end: load list → connect wallet → Fix & Send → 1 signature → 17 rows "Sent" with block + before→after | `scripts/ui-e2e-fork.mjs` (injected test wallet, `//Alice`) | 2026-11-05 | verified on **V3 fork** (no real extension) |
| Cancelling the signature leaves nothing sent and shows a clear message | `E2E_CANCEL=1 scripts/ui-e2e-fork.mjs` | 2026-11-05 | verified on **V3 fork** |
| A failing batch is caught by `system_dryRun` on the signed bytes; nothing is broadcast (nonce unchanged) | `spike/failure-paths.ts` | 2026-11-05 | verified on **live V3** (unfunded key: payment invalid) and on fork (`TokenError.CannotCreate`) |
| Baseline: node-console manual distribution of 20 rows | §11 | — | **not measured yet** |

## Problem evidence (from docs)
- Integritee: decimal mistake reaped the sudo account. https://hackmd.io/@brenzi5/B1jBRMUb5
- Talisman: amount + fee below ED reaps the account and burns the remainder. https://docs.talisman.xyz/talisman/help-and-support/troubleshooting/ed
- Polkassembly: DED stuck on Asset Hub with no native balance. https://polkadot.polkassembly.io/post/2364
- Portaldot V3 guide: manual runtime-call lookup to fund an EVM address. https://github.com/ItsCogumellum/portaldot-v3-testnet-guide
- Polkadot forum RFC: assets of reaped accounts are effectively lost. https://forum.polkadot.network/t/polkadot-protocol-proposals-rfc-process/1421/31

## Spec deviations
- Added `AMOUNT_INVALID` (missing / zero / too many decimals). §3 had no code for an unparseable amount.
- `DECIMAL_SUSPECT` uses ≥1000× the median (spec example was ≥10^decimals × median, which is too loose to catch real mistakes) or <1 unit when every other row is whole.
- Dry-run: `system_dryRun` needs a *signed* extrinsic. Dropcheck signs once, dry-runs those exact bytes, and broadcasts the same bytes only if the dry-run passes. That's still one signature.
- UI is light-only by design (painted landscape theme per design reference); `dark:` styles remain for a future toggle. Spec §7 asked for light/dark.

## Bugs found by the fork rehearsal (fixed 2026-11-05)
- Browser ignored `NEXT_PUBLIC_DROPCHECK_*` overrides (dynamic `process.env[key]`; Next.js only inlines literal references).
- Wallets whose state had not been read yet were classified as empty → invented top-ups (17 instead of 5), and Fix & Send
  stayed enabled while reads and the fee estimate were in flight. Now: unread = unknown and blocks the run; the fee is bound
  to the exact plan and sender it was estimated for.
- Dispatch errors of type `TokenError` printed as raw JSON; now decoded (`TokenError.CannotCreate`).
- Sender balance in the header was stale after a send; the on-chain column overflowed the table.
