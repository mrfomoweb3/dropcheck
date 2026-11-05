# On-chain proof (Portaldot V3 testnet)

Dropcheck uses native pallets (Assets, Balances, Utility). There is no contract, so the on-chain artifacts are the
**asset ID** and the **extrinsics** below. node-console has no tx-hash search, so each row links to its block.
All rows are on the **public V3 testnet** (genesis `0xd4f9acbc…83bd`), sent from the demo key
`5Cg3VnuJTQQKwC9bcTVRXM1ygaMj7vRzPQ39jdp71NVd163A`.

Demo asset ID: **895266** (Dropcheck Demo, DROP, 6 decimals, min_balance 5 DROP, non-sufficient)

| Block time (UTC) | What | Tx hash | Block | Notes |
|---|---|---|---|---|
| 2026-11-05 15:06:36 | spike step 7: top-up + asset transfer to a fresh wallet | `0x7cb69e7b9fe8cb49f5f87d64f11b569606ec0354274375abcc434676eae67604` | [#336167](https://node-console.portaldot.dev/?rpc=wss%3A%2F%2Ftest-node-v3.portaldot.dev#/explorer/query/336167) | fresh wallet holds 10 DROP (spike asset 39590) |
| 2026-11-05 15:07:48 | create demo asset (`seed-demo`) | `0x430f1eee08228f6a1cd9fa59e96b20174753c6dbce382a6e5889c90931cb07ca` | [#336179](https://node-console.portaldot.dev/?rpc=wss%3A%2F%2Ftest-node-v3.portaldot.dev#/explorer/query/336179) | create + setMetadata + mint |
| 2026-11-05 15:08:18 | live test A5–A7 (`pnpm test:live`, headless) | `0x0e28e80e9485fbcce521c41bd06ed3008320c276b032df5e44c0f6b295b630b4` | [#336184](https://node-console.portaldot.dev/?rpc=wss%3A%2F%2Ftest-node-v3.portaldot.dev#/explorer/query/336184) | 1 signature: 5 top-ups + 17 asset transfers, 2 skipped, 1 merged |
| 2026-11-05 15:12:36 | browser UI send (`scripts/ui-e2e.mjs`, production build) | `0x2866dff24296b3dc780f635b27400101604ea26091d83e88a5e4232034abf77a` | [#336227](https://node-console.portaldot.dev/?rpc=wss%3A%2F%2Ftest-node-v3.portaldot.dev#/explorer/query/336227) | same list shape via the real UI; 14.8 s end to end; signer injected by the test |

Failure-path proofs (expected failures, live) are in [SPIKE.md](SPIKE.md): `TokenError.CannotCreate` #336163,
`TokenError.BelowMinimum` #336165 / #336166.
