# Feasibility spike (§4)

Run log: `docs/spike-connect.log` (steps 1–4) and `docs/spike-funded.log` (steps 5–9).
Commands: `node spike/connect.ts` and `node --env-file=.env spike/funded.ts`.

## Steps 1–4 (verified on V3, 2026-10-26, block ~#200,975)

| Item | Result |
|---|---|
| Genesis | `0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd` |
| Spec | `portaldot-v3` / 3002, chain "PortaldotV3 Test", 69 pallets |
| Properties | ss58Format 42, tokenDecimals 14, tokenSymbol **tPOT** (not `tPOTv3`) |
| EVM chain id | `eth_chainId` → `0x190f1ca9` = 420420777 |
| Existential deposit | 10,000,000,000,000 planck = **0.1 tPOT** |
| Max block weight | refTime 2,000,000,000,000 |
| `utility.batchedCallsLimit` | 10,922 |
| Assets deposits | assetDeposit 1 tPOT · assetAccountDeposit 1 tPOT · metadataDepositBase 0.1 · perByte 0.06 · stringLimit 50 |
| `balances.transfer` | **absent** (confirmed) |
| `balances.transferKeepAlive` / `transferAllowDeath` | present |
| `assets.create/setMetadata/mint/transferKeepAlive/touch/touchOther` | present |
| `utility.batchAll` / `forceBatch` | present |
| `system_dryRun` RPC | **present** |
| `api.call.reviveApi.accountId` | present |
| Assets errors | include `UnavailableConsumer`, `BalanceLow`, `NoAccount`, `Frozen`, `AssetNotLive`, `WouldDie` (no `BelowMinimum` in error list: it's a TokenError) |

### Address mapping (A2)
`0xf7eC65d11e35375A250e474059a917B537804142`
- `ReviveApi.account_id` → `5Hfmuhj1AHrTBJiC9zUPnJo1cfG2G52LLMwofSigBnjtto8Y` ✅
- fallback `h160 ++ 0xEE×12` → same ✅
- `Revive.OriginalAccount(h160)` → `null` (not mapped; fallback is what the runtime uses)
- Reverse `ReviveApi.address(5Hfmuhj…)` → `0xf7ec…4142` ✅

## Steps 5–9: run on a local Chopsticks fork of V3 (2026-11-05)

**Not live V3.** The demo sender has no tPOT yet (no public faucet). So steps 5–9 ran on a
[Chopsticks](https://github.com/AcalaNetwork/chopsticks) fork (`spike/fork.yml`), which executes the **same V3 runtime wasm
(portaldot-v3/3002) on live V3 state** forked at block ~#334,273. Only the sender's balance is synthetic: the public dev key
`//Alice` is given 10,000 tPOT. Tx hashes below exist only on that local fork, not on the public chain.
Log: `docs/spike-fork.log`.

| Step | Result on fork |
|---|---|
| 5. `batch_all(create, setMetadata, mint)`, non-sufficient, min_balance 5 DROP | ✅ asset 24952 created (`assets.Created`, `MetadataSet`, `Issued`) |
| 6a. asset transfer to fresh account, no native | ❌ **`TokenError.CannotCreate`** (spec guessed `NoProvider`/`UnavailableConsumer`) |
| 6b. asset transfer below min_balance to new holder (with native) | ❌ `TokenError.BelowMinimum` |
| 6c. native `transfer_keep_alive` below ED to new account | ❌ `TokenError.BelowMinimum` |
| 7. **`batch_all(top-up ED+10%, asset transfer)` to fresh account** | ✅ **asset arrives**: `Assets.Account = {balance 10 DROP, status Liquid, reason Consumer}` |
| 8. EVM-side assets precompile (live V3 EVM RPC, asset 7777) | none found: `eth_call totalSupply()/symbol()` at `0x{id:08x}…01200000` and `0xFFFFFFFF…{id}` both return `0x` |
| 9. 50 recipients (50 top-ups + 50 transfers = 100 calls) | ✅ included in one block. Weight refTime 36.5 G of 2,000 G (1.8%), proof 506 KB, fee 0.436 tPOT |

## Decision

**GO** (on the fork, i.e. on the V3 runtime). Step 7 must still be repeated on live V3 once the demo sender is funded
(`pnpm spike:funded`); `docs/PROOF.md` stays empty until then.
