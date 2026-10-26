# Architecture

```
┌──────────────────────── Browser (Next.js static export) ───────────────────┐
│  Paste / CSV ─► core/input ─► core/address ─► core/checks ─► ResultsTable   │
│                                    │               │                        │
│                     core/chain (queryMulti,        ▼                        │
│                     ReviveApi.account_id)     core/planner ─► fee preview   │
│                                                    │                        │
│         core/submit: sign once (extension) ─► system_dryRun ─► broadcast    │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ WSS (@polkadot/api)
                Portaldot V3 testnet: Balances · Assets · Utility · Revive
```

- `src/core/` is framework-free and runs in Node (tests, headless runner, seed script) and the browser.
- `checks.ts` is pure: `(rows, ChainSnapshot) → issues`. All chain reads happen once per edit, batched with `queryMulti`.
- Plan = per chunk `batch_all([transfer_keep_alive top-ups…, assets.transfer_keep_alive…])`. Top-ups always go in the same
  chunk as the transfers that need them. `batch_all` is atomic.
- No backend. No keys in the app: signing happens through the polkadot.js extension API (Talisman, SubWallet, PJS).
- All amounts are `bigint` planck; `units.ts` does decimal conversion with string math.
