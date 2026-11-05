# Dropcheck

**Usability over complexity.** Portaldot Hacker House 2026 · Track 4: Ecosystem DApps

> For community managers and token issuers about to distribute a Portaldot Assets-pallet token to a list of wallets,
> Dropcheck shows exactly which transfers would fail or strand tokens and fixes them all in one signed batch,
> producing verifiable on-chain transfers in under 30 seconds of interaction.

- **Live demo:** _TBD (Vercel URL)_
- **Demo video:** _TBD_
- **Team:** _TBD_

## Status (2026-11-05)
| | |
|---|---|
| Check engine, planner, units, address resolution | ✅ 33 unit tests (`pnpm test`) |
| Live checks against V3 chain state (demo list on DROP, asset 895266) | ✅ verified on **live V3**, in the browser and headless |
| H160 → native mapping via `ReviveApi.account_id` | ✅ verified on **live V3** (test A2) |
| Dry-run safety net: a failing batch is never broadcast | ✅ verified on **live V3** and on a V3 fork |
| Full send: 1 signature → 5 top-ups + 17 transfers, fresh wallets receive the token, sender never reaped | ✅ verified on **live V3**, headless (`pnpm test:live`, block [#336184](https://node-console.portaldot.dev/?rpc=wss%3A%2F%2Ftest-node-v3.portaldot.dev#/explorer/query/336184)) and through the browser UI (block [#336227](https://node-console.portaldot.dev/?rpc=wss%3A%2F%2Ftest-node-v3.portaldot.dev#/explorer/query/336227)); see [docs/PROOF.md](docs/PROOF.md) |
| Lists over 50 recipients: ordered batches, one signature each | ✅ verified on **live V3**: 55 never-used wallets → 2 batches (100 + 10 calls), all 55 received ([PROOF](docs/PROOF.md)) |
| A first-time visitor (judge) can run the whole demo from their own wallet | ✅ verified on **live V3** in the production UI: wallet with 3 tPOT and no DROP → **Create my demo token** (1 signature) → Fix & Send (1 signature) → 17 sent, 48.5 s |
| Demo never goes stale | ✅ the 5 "fresh" rows are regenerated as brand-new accounts on every page load, so the top-up case always shows |
| Runtime upgrade / slow node | ✅ if the shipped metadata no longer matches, the app says so and downloads it (plain `state_getMetadata`, fresh connection per attempt, then cached). Simulated in the browser: 5/5 connected in 25–40 s. A lost send confirmation is recovered by scanning new blocks for the tx |
| Browser send with a real wallet extension (polkadot.js / Talisman / SubWallet) | ⏳ not yet run by us: the UI tests inject their own signer. The extension path uses the standard `@polkadot/extension-dapp` signer |

## The 30-second test
1. Open the app. The demo list is already loaded and checked against live chain state: rows go **red / amber / green**,
   each with a plain-English reason and the fix that will be applied. No wallet needed for this part.
2. Connect a Portaldot wallet extension (Talisman, SubWallet or polkadot{.js}) with about **3 tPOT**.
3. Your wallet doesn't hold the demo token yet, so click **Create my demo token**: one signature creates your own copy
   (2.18 tPOT is held as the token deposit, not spent). The list switches to it.
4. **Fix & Send** → review totals and fee → sign once. Every row turns green with a link to its block.

If the public node is down, add `?rpc=wss://<another V3 node>` to the URL. The app still refuses any chain whose genesis
isn't Portaldot V3 testnet.

## Problem
Airdrops on Substrate chains fail or silently strand tokens:
- A fresh wallet with no native token can't hold a non-sufficient asset, so the transfer fails. **Every asset on V3 today is
  non-sufficient** (verified, see [docs/EVIDENCE.md](docs/EVIDENCE.md)).
- Amounts below the asset's `min_balance`, decimal mix-ups (14-decimal native token), and amount + fee pushing the sender below
  the existential deposit (account reaped).
- MetaMask (H160) recipients need a manual runtime-call lookup to find their native account.

Evidence: [Integritee](https://hackmd.io/@brenzi5/B1jBRMUb5) · [Talisman ED docs](https://docs.talisman.xyz/talisman/help-and-support/troubleshooting/ed) ·
[Polkassembly #2364](https://polkadot.polkassembly.io/post/2364) · [V3 guide](https://github.com/ItsCogumellum/portaldot-v3-testnet-guide) ·
[Polkadot RFC thread](https://forum.polkadot.network/t/polkadot-protocol-proposals-rfc-process/1421/31)

## Why Track 4 / why Portaldot
- **Native Assets pallet**: tokens without an ERC-20 contract, but with Substrate's provider/consumer and `min_balance` rules.
- **Atomic `Utility.batch_all`**: top-ups and transfers succeed or fail together, under one signature.
- **Revive address mapping**: `ReviveApi.account_id` turns MetaMask addresses into native accounts automatically.

## What it checks
`ADDR_INVALID` · `ADDR_WRONG_PREFIX` (re-encodes) · `ADDR_EVM` (resolves) · `AMOUNT_INVALID` · `DUPLICATE` (merges) ·
`NO_PROVIDER` (prepends ED + 10% top-up) · `BELOW_MIN_BALANCE` · `RECIPIENT_FROZEN` · `ASSET_FROZEN` · `DECIMAL_SUSPECT` ·
`SENDER_SHORT_ASSET` · `SENDER_SHORT_NATIVE` · `EVM_VISIBILITY`

## Architecture
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Static Next.js app, no backend, framework-free `src/core/`.

## On-chain proof
Native pallets, no contract: the artifacts are the demo **asset ID 895266 (DROP)** and the **extrinsics** in [docs/PROOF.md](docs/PROOF.md).

## Run it
```bash
pnpm i && pnpm dev            # http://localhost:3000
pnpm test                     # unit tests (no network)
pnpm typecheck && pnpm lint && pnpm build
```

Demo data and live tests need a **demo-only** funded seed file outside the repo (mode 600). The path goes in `.env`
(see `.env.example`). Never commit a seed.
```bash
node scripts/gen-demo-key.ts ~/.dropcheck/demo-seed   # prints the address to fund
pnpm seed-demo                # creates demo asset, writes public/demo.json + demo-list.csv
pnpm demo:headless            # same flow from the CLI (read-only; add --send to submit)
pnpm test:live                # A5–A7 on V3, appends tx to docs/PROOF.md
```

## Limitations
- Testnet only. The app refuses any genesis other than Portaldot V3 testnet.
- To send, your wallet must hold the token and some tPOT. Anyone can *preview* the demo; to *send* it, a visitor creates their
  own demo token in one click (about 3 tPOT total; there is no public V3 faucet).
- Demo tokens sent to the regenerated "fresh" rows go to random accounts nobody holds a key for (testnet only, by design:
  it guarantees a never-used wallet every time).
- MetaMask may not display Assets-pallet balances (see `EVM_VISIBILITY`).
- One atomic batch per 50 recipients. Larger lists are split into ordered chunks, one signature each. Each chunk is
  atomic on its own; if chunk 2 fails, chunk 1 has already landed (the app shows which rows were sent).
- One public V3 node exists as far as we know. `?rpc=` lets you point at another one.

## Credits
polkadot.js (`@polkadot/api`, `util`, `util-crypto`, `extension-dapp`, `keyring`), Next.js, Tailwind CSS, PapaParse, Vitest, Chopsticks (fork rehearsal), Puppeteer (UI tests).

## AI assistance disclosure
This project was built with AI assistance (Claude Code) for code, tests and docs. On-chain claims were verified by running
the scripts against V3; see [docs/EVIDENCE.md](docs/EVIDENCE.md).
