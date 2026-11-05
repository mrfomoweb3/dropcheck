# Fork rehearsal (local Chopsticks fork of Portaldot V3)

**These are not live-V3 transactions.** They ran on a local fork that executes the real V3 runtime
(`portaldot-v3`/3002) against live V3 state. Only the sender balance is synthetic (public dev key `//Alice`).
The hashes below exist only on that fork. Live proof goes in [PROOF.md](PROOF.md) once the demo sender is funded.

## Results (2026-11-05)
| What | Fork block | Tx hash | Outcome |
|---|---|---|---|
| Spike 7: top-up + asset transfer to a fresh account | #334284 | `0x6acd3be5cc2e3951130b2f20050d5c9fe875c28ad1ca768e59438607b0a63cb5` | ✅ fresh account holds 10 DROP |
| Spike 9: 50 top-ups + 50 transfers in one `batch_all` | #334285 | `0x0f3f254ee51b4e744bcc0dc3b978ead59905d813b77fa8e478e9cb4e87d97818` | ✅ `BatchCompleted`, 1.8% of block weight |
| Live test A5–A7 (headless, demo list) | #334288 | `0x6ded4e291bc7568478e6f0bc9e5b1ef8fc688a0459678bb6ec87fd96644f2423` | ✅ 17 transfers, 5 top-ups, 2 excluded, 1 merged |
| Browser UI end to end (Fix & Send, one signature) | #334292 | (shown in UI) | ✅ 17 rows "Sent", 2 skipped, 1 merged, 0 failed, ~30 s |
| Browser UI, signature cancelled | — | — | ✅ "You cancelled the signature. Nothing was sent." |
| Failing batch caught by dry-run (fork + **live V3**) | — | — | ✅ nothing broadcast, nonce unchanged |

## How to reproduce
Chopsticks 1.5.2 can't run from a path containing spaces (it URL-encodes its own module paths), so install it elsewhere:
```bash
mkdir -p /tmp/forktool && cd /tmp/forktool && npm i @acala-network/chopsticks@1.5.2
npx chopsticks --config "<repo>/spike/fork.yml"          # ws://localhost:8000

# in the repo (//Alice is a public dev key, not a secret)
printf '//Alice\n' > /tmp/fork-seed && mkdir -p /tmp/forkdemo
export NEXT_PUBLIC_DROPCHECK_WSS=ws://localhost:8000 DEMO_SEED_FILE=/tmp/fork-seed
pnpm spike:funded                                         # steps 5–9 (state in spike/state.fork.json)
DEMO_OUT=/tmp/forkdemo pnpm seed-demo                     # demo asset + 20-row list
DEMO_JSON=/tmp/forkdemo/demo.json PROOF_FILE=/tmp/forkdemo/PROOF.fork.md pnpm test:live
tsx spike/failure-paths.ts <assetId>                      # dry-run safety net
DEMO_OUT=/tmp/forkdemo pnpm seed-demo && pnpm dev --port 3001 &   # fresh list, app on the fork
node scripts/ui-e2e-fork.mjs http://localhost:3001/app /tmp/forkdemo/demo.json /tmp/e2e        # happy path
E2E_CANCEL=1 node scripts/ui-e2e-fork.mjs http://localhost:3001/app /tmp/forkdemo/demo.json /tmp/e2e   # cancel path
```
