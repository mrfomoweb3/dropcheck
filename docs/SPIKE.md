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

## Steps 5–9

PENDING: needs a funded demo sender (`5Cg3VnuJTQQKwC9bcTVRXM1ygaMj7vRzPQ39jdp71NVd163A`).
There is no public faucet; tPOT comes from the hackathon distribution / Discord ticket.

## Decision

PENDING step 7.
