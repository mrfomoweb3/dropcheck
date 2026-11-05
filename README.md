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
| Check engine, planner, units, address resolution | ✅ 32 unit tests (`pnpm test`) |
| Live checks against V3 chain state (preview list on pUSD, asset 7777) | ✅ verified in the browser and headless (`pnpm demo:headless`) |
| H160 → native mapping via `ReviveApi.account_id` | ✅ verified on V3 |
| Fee estimate (`paymentInfo`) for the batch | ✅ verified on V3 |
| Signed `batch_all` send on V3 (top-ups + transfers) | ⏳ **not yet run**: the demo sender has no tPOT yet. No tx hash is claimed until it has run; see [docs/PROOF.md](docs/PROOF.md) |

## The 30-second test
1. Open the app. The demo list is already loaded and checked against live chain state.
2. Rows go **red / amber / green**, each with a plain-English reason and the fix that will be applied.
3. **Fix & Send** → review totals and fee → sign once in your wallet extension.
4. Every row turns green with a link to its block on node-console.

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
Native pallets, no contract: the artifacts are the demo **asset ID** and **extrinsics**. See [docs/PROOF.md](docs/PROOF.md).

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
- To send, your wallet must hold the token. Anyone can *preview* the demo list; sending the demo needs the demo asset.
- MetaMask may not display Assets-pallet balances (see `EVM_VISIBILITY`).
- One atomic batch per 50 recipients. Larger lists are split into ordered chunks, one signature each.

## Credits
polkadot.js (`@polkadot/api`, `util`, `util-crypto`, `extension-dapp`, `keyring`), Next.js, Tailwind CSS, PapaParse, Vitest.

## AI assistance disclosure
This project was built with AI assistance (Claude Code) for code, tests and docs. On-chain claims were verified by running
the scripts against V3; see [docs/EVIDENCE.md](docs/EVIDENCE.md).
