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
| Asset transfer to an account with no native balance fails (`UnavailableConsumer` expected) | spike step 6a | — | **assumption: pending funded run** |
| Transfer below `min_balance` to a new holder fails (`BelowMinimum` expected) | spike step 6b | — | **assumption: pending** |
| Native transfer below ED to a new account fails (`ExistentialDeposit` expected) | spike step 6c | — | **assumption: pending** |
| `batch_all(top-up, asset transfer)` makes a fresh account hold the asset | spike step 7 | — | **assumption: pending** |
| Assets precompile on EVM side | spike step 8 | — | **unknown: pending** |
| 50-recipient batch (100 calls) fits in one block | spike step 9 | — | **assumption: pending** |
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
