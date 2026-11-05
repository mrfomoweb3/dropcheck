# On-chain proof (Portaldot V3 testnet)

Dropcheck uses native pallets (Assets, Balances, Utility). There is no contract, so the on-chain artifacts are the
**asset ID** and the **extrinsics** below. node-console has no tx-hash search, so each row links to its block.
All rows are on the **public V3 testnet** (genesis `0xd4f9acbc…83bd`). Unless noted, they were sent from the demo key
`5Cg3VnuJTQQKwC9bcTVRXM1ygaMj7vRzPQ39jdp71NVd163A`.

Demo asset ID: **895266** (Dropcheck Demo, DROP, 6 decimals, min_balance 5 DROP, non-sufficient).
Failure-path proofs (expected failures, live) are in [SPIKE.md](SPIKE.md): `TokenError.CannotCreate` #336163,
`TokenError.BelowMinimum` #336165 / #336166. `pnpm test:live` appends a row to the table below on every run.

| Block time (UTC) | What | Tx hash | Block | Notes |
|---|---|---|---|---|
| 2026-11-05 15:06:36 | spike step 7: top-up + asset transfer to a fresh wallet | `0x7cb69e7b9fe8cb49f5f87d64f11b569606ec0354274375abcc434676eae67604` | [#336167](https://node-console.portaldot.dev/?rpc=wss%3A%2F%2Ftest-node-v3.portaldot.dev#/explorer/query/336167) | fresh wallet holds 10 DROP (spike asset 39590) |
| 2026-11-05 15:07:48 | create demo asset (`seed-demo`) | `0x430f1eee08228f6a1cd9fa59e96b20174753c6dbce382a6e5889c90931cb07ca` | [#336179](https://node-console.portaldot.dev/?rpc=wss%3A%2F%2Ftest-node-v3.portaldot.dev#/explorer/query/336179) | create + setMetadata + mint |
| 2026-11-05 15:08:18 | live test A5–A7 (`pnpm test:live`, headless) | `0x0e28e80e9485fbcce521c41bd06ed3008320c276b032df5e44c0f6b295b630b4` | [#336184](https://node-console.portaldot.dev/?rpc=wss%3A%2F%2Ftest-node-v3.portaldot.dev#/explorer/query/336184) | 1 signature: 5 top-ups + 17 asset transfers, 2 skipped, 1 merged |
| 2026-11-05 15:12:36 | browser UI send (`scripts/ui-e2e.mjs`, production build) | `0x2866dff24296b3dc780f635b27400101604ea26091d83e88a5e4232034abf77a` | [#336227](https://node-console.portaldot.dev/?rpc=wss%3A%2F%2Ftest-node-v3.portaldot.dev#/explorer/query/336227) | same list via the real UI; 14.8 s end to end; signer injected by the test |
| 2026-11-05 18:01:48 | 55 recipients → 2 batches (`spike/multichunk.ts`), batch 1 of 2 | `0xbc8700b5ebd60cecb99d56b64b3a1c5a66256791c4f430e7a8b33001c9e4fed3` | [#337909](https://node-console.portaldot.dev/?rpc=wss%3A%2F%2Ftest-node-v3.portaldot.dev#/explorer/query/337909) | full 100-call batch (50 top-ups + 50 transfers) |
| 2026-11-05 18:02:06 | same run, batch 2 of 2 | `0x1c1b850547aae9e449de139f25d40ea286acfc55b5eca9fa6f4966dd9619d8f0` | [#337912](https://node-console.portaldot.dev/?rpc=wss%3A%2F%2Ftest-node-v3.portaldot.dev#/explorer/query/337912) | 10 calls; all 55 recipients hold their exact amount |
| 2026-11-05 18:05:24 | first visitor UI run: create demo token (throwaway wallet 5FPRsW…zDSf, funded 3 tPOT by the demo key at #337938) | `0x60ee3b29d8e5b3881e5aeab9cba0a93d564f76441f76f2af36ad1bab4d08a61f` | [#337945](https://node-console.portaldot.dev/?rpc=wss%3A%2F%2Ftest-node-v3.portaldot.dev#/explorer/query/337945) | token 1116579 |
| 2026-11-05 18:05:48 | same run: Fix & Send | `0xc5c8504e6ed8c01477772ac1fbf3214c704adbc4eeea2a73649f74472f939418` | [#337949](https://node-console.portaldot.dev/?rpc=wss%3A%2F%2Ftest-node-v3.portaldot.dev#/explorer/query/337949) | 17 transfers + 5 top-ups landed, but the UI never received the confirmation (the test timed out). This led to the confirmation watchdog |
| 2026-11-05 18:53:06 | first-time visitor creates their own demo token in the UI (`scripts/ui-e2e-visitor.mjs`) | `0x23300eb30bbd461485aa6d91ce46086222effd4a719db8a1f2992b26d15d8a74` | [#338420](https://node-console.portaldot.dev/?rpc=wss%3A%2F%2Ftest-node-v3.portaldot.dev#/explorer/query/338420) | throwaway visitor wallet 5GnNii…PMU1 (3 tPOT, no DROP); token 5071652 |
| 2026-11-05 18:53:18 | same visitor: Fix & Send on a freshly generated demo list | `0xeaf367383dea3f91d8152cb03a4c9bb8b595e025095b801521e1d9507f08d01a` | [#338422](https://node-console.portaldot.dev/?rpc=wss%3A%2F%2Ftest-node-v3.portaldot.dev#/explorer/query/338422) | 17 sent, 2 skipped, 0 failed; 2 signatures in total, 48.5 s |
| 2026-11-05 18:54:05 (run end) | live test A5–A7 re-run (fresh rows regenerated) | `0x135ac60961fba120596bbf25c43efe09641cd3ca4630178bc8e9a40f32374813` | [#338429](https://node-console.portaldot.dev/?rpc=wss%3A%2F%2Ftest-node-v3.portaldot.dev#/explorer/query/338429) | 5 top-ups + 17 asset transfers, asset 895266 |
