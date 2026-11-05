# Sources and provenance

- Original problem report: [Polkadot Asset Hub Frozen Assets](https://polkadot.polkassembly.io/post/2364), by vitg6. Community post, not a Dropcheck customer story. The author reports DED tokens stuck after transfer to Asset Hub without enough DOT. Short quotation: “due to insufficient balance of DOT tokens”. Dropcheck checks future Portaldot distributions; it does not recover that user's Asset Hub funds.
- Integritee incident write-up is cited by the repo at https://hackmd.io/@brenzi5/B1jBRMUb5 but could not be fetched in this session; not used for factual claims in this film.
- Actual product screens: locally served exported Next.js app, read-only preview, captured with Puppeteer at 1440×1000, device scale 2. See assets/capture.json.
- Prior testnet proof: ../../docs/PROOF.md and ../../docs/EVIDENCE.md. Browser test block #336227: 17 assets transfers, 5 native top-ups, one batch; injected test signer. This film does not execute or simulate a fresh send.
- Brand assets: src/app/components/Logo.tsx, public/landscape.jpg, locally built Figtree / Shadows Into Light fonts.
- Effects: HyperFrames bundled Pixabay effects; see assets/CREDITS.md.

## Follow-up source search

Compared the direct Polkassembly report with Talisman’s “Substrate transaction fails due to existential deposit” (https://docs.talisman.xyz/talisman/help-and-support/troubleshooting/ed), the Fearless Wallet team’s firsthand report (https://forum.polkadot.network/t/request-for-assistance-with-trapped-asset-issues-on-polkadot-relay-chain/7732), the official assets guide (https://guide.kusama.network/docs/learn-assets), and general explainers. Kept the direct report because its missing-native-balance issue most closely matches the recipient top-up shown. It is accurately called a community post, not a blog. No article is presented as proven historical inspiration for building the project.

Music: explicitly reused existing HeyGen catalog media, track e6e3f87883d948db9959578999794430 (sha eb2dc5ed85822a240d06609b48e6f7d14fbf955f2847a67320a01a74c5e3f24a), originally resolved with query “minimal tense electronic pulse, 100-110 bpm, building to a calm bright resolve, no vocals, tech product demo”. Copied via HyperFrames media resolver; music-bed.wav repeats to 48 seconds with 0.4s / 1.5s edge fades. Narration pending HeyGen sign-in.

## Narration

User selected a free open-source voice after HeyGen required a plan. Narration uses Kokoro-82M, voice af_heart, speed 1.02, via the model author's public CPU demo at https://huggingface.co/spaces/hexgrad/Kokoro-TTS (https://hexgrad-kokoro-tts.hf.space). Model and Apache-2.0 license: https://huggingface.co/hexgrad/Kokoro-82M. The script text is public product-demo copy. Local package/model downloads were too slow; no paid voice service was used. Brand pronunciations are written as “Drop check” and “Portal dot” only in speech input.
