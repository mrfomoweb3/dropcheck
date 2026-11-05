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
| Asset transfer to an account with no native balance fails with **`TokenError.CannotCreate`** | spike step 6a, `docs/spike-live.log` (block #336163) | 2026-11-05 | verified on **live V3** (and fork) |
| Transfer below `min_balance` to a new holder fails with `TokenError.BelowMinimum` | spike step 6b (block #336165) | 2026-11-05 | verified on **live V3** (and fork) |
| Native transfer below ED to a new account fails with `TokenError.BelowMinimum` | spike step 6c (block #336166) | 2026-11-05 | verified on **live V3** (and fork) |
| `batch_all(top-up, asset transfer)` makes a fresh account hold the asset | spike step 7 (block #336167) | 2026-11-05 | verified on **live V3** (and fork) |
| No ERC-20 assets precompile found on the EVM side (asset 7777, two standard address formats return `0x`) | `eth_call` on live EVM RPC | 2026-11-05 | verified (live V3) |
| 50-recipient batch (100 calls) is included in one block: 1.8% of block refTime, fee 0.436 tPOT | spike step 9 | 2026-11-05 | fee/weight verified on **live V3** (`payment_queryInfo`); inclusion of the full 100-call batch verified on **V3 fork** only |
| Live test A5–A7: demo list → 1 signature → 17 asset transfers, 5 top-ups, 2 excluded, 1 merged; fresh accounts hold the asset; sender ≥ ED | `pnpm test:live` | 2026-11-05 | verified on **live V3**: tx `0x0e28e80e…30b4`, block #336184 (see PROOF.md); earlier on fork |
| Browser UI end to end: load list → connect wallet → Fix & Send → 1 signature → 17 rows "Sent" with block + before→after | `scripts/ui-e2e.mjs` (injected test wallet; production build) | 2026-11-05 | verified on **live V3**: tx `0x2866dff2…f77a`, block #336227, 14.8 s, 0 page errors. Signer injected by the test, **not a real browser extension** |
| Cancelling the signature leaves nothing sent and shows a clear message | `E2E_CANCEL=1 scripts/ui-e2e.mjs` | 2026-11-05 | verified on **V3 fork** |
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

## Independent on-chain check of the live sends (2026-11-05)
Read back from chain, not from the app: both blocks #336184 and #336227 contain one `utility.batchAll` (22 calls) from the
demo sender with 17 `assets.Transferred`, 5 `balances.Transfer`, 5 `system.NewAccount`, `ExtrinsicSuccess`, and **no**
`KilledAccount`. The 5 fresh wallets of the UI run each hold exactly their DROP amount (50/60/70/80/90) plus 0.11 tPOT.

## Robustness work after the first live run (2026-11-05)
| Claim | Source | Status |
|---|---|---|
| >50 recipients: 55 fresh wallets → 2 batches (100 + 10 calls), 2 signatures, all 55 hold their exact amount | `spike/multichunk.ts`, `docs/multichunk-live.log`, blocks #337909/#337912 | verified on **live V3** |
| A wallet with 3 tPOT and no demo token completes the demo in the production UI: create own token (1 sig) + Fix & Send (1 sig), 17 sent, 0 failed | `scripts/ui-e2e-visitor.mjs`, blocks #338420/#338422 | verified on **live V3** (injected signer) |
| Visitor token cost: deposit = assetDeposit 1 + metadataDepositBase 0.1 + 0.06 × 18 bytes = **2.18 tPOT reserved**; matched the visitor's on-chain `reserved` exactly | runtime constants + `system.account` | verified on **live V3** |
| `Metadata_metadata_at_version` via `state_call` makes the public node drop the socket (1006); plain `state_getMetadata` returns ~1.1 MB in ~20 s | raw RPC timing from Node | verified on **live V3** (one machine, one day; node behaviour may change) |
| Runtime-upgrade path: with a non-matching snapshot and empty cache, the app shows an "updated chain" note and connects | `scripts/ui-upgrade-sim.mjs`, 5/5 runs, 25–40 s | verified against **live V3** (simulated upgrade) |
| Lost confirmation recovery: `findIncluded` finds a known tx and decodes success and `TokenError.CannotCreate` failures from block events | ad-hoc script against #336227 / #336163 | verified on **live V3**. The watchdog itself (dropped socket mid-send) was **not** reproduced on demand |
| `pnpm test:live` is repeatable (fresh rows regenerated per run) | second run, block #338429 | verified on **live V3** |

## Bugs found by the live run (fixed 2026-11-05)
- The first visitor UI run never confirmed its send (the node dropped sockets during the run; the status subscription
  went quiet and nothing timed out). `signAndSend` now has a 60 s watchdog that scans new blocks for the tx hash.
- After a runtime upgrade the app would have failed to connect at all (see the state_call row above). Fixed.
- The visitor cost check used a fixed 0.15 tPOT send-fee buffer and blocked a 3 tPOT wallet that actually succeeds;
  it now uses the app's live fee estimate.
- EVM addresses were never resolved through `ReviveApi.account_id` in the app: the shipped metadata snapshot is v14 (no
  runtime-API section), so `api.call.reviveApi` was undefined and every H160 silently used the `h160 ++ 0xEE×12` fallback.
  Correct for unmapped accounts, wrong for accounts that called `map_account`. Now a raw `state_call('ReviveApi_account_id')`.
  Caught by live test A2.
- `seed-demo` reused asset 7777 (pUSD) from the shipped preview `demo.json`, which the demo key doesn't own. Now it only
  reuses an asset the sender owns.
- Node scripts downloaded the full 1 MB metadata on every connect and timed out on the live node; they now reuse the
  snapshot like the browser (`scripts/node-connect.ts`).

## Bugs found by the fork rehearsal (fixed 2026-11-05)
- Browser ignored `NEXT_PUBLIC_DROPCHECK_*` overrides (dynamic `process.env[key]`; Next.js only inlines literal references).
- Wallets whose state had not been read yet were classified as empty → invented top-ups (17 instead of 5), and Fix & Send
  stayed enabled while reads and the fee estimate were in flight. Now: unread = unknown and blocks the run; the fee is bound
  to the exact plan and sender it was estimated for.
- Dispatch errors of type `TokenError` printed as raw JSON; now decoded (`TokenError.CannotCreate`).
- Sender balance in the header was stale after a send; the on-chain column overflowed the table.
