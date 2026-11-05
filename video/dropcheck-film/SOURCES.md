# Sources and provenance

- Original problem report: [Polkadot Asset Hub Frozen Assets](https://polkadot.polkassembly.io/post/2364), by vitg6. Community post, not a Dropcheck customer story. The author reports DED tokens stuck after transfer to Asset Hub without enough DOT. Short quotation: “due to insufficient balance of DOT tokens”. Dropcheck checks future Portaldot distributions; it does not recover that user's Asset Hub funds.
- Integritee incident write-up is cited by the repo at https://hackmd.io/@brenzi5/B1jBRMUb5 but could not be fetched in this session; not used for factual claims in this film.
- Actual product screens: locally served exported Next.js app, read-only preview, captured with Puppeteer at 1440×1000, device scale 2. See assets/capture.json.
- Prior testnet proof: ../../docs/PROOF.md and ../../docs/EVIDENCE.md. Browser test block #336227: 17 assets transfers, 5 native top-ups, one batch; injected test signer. This film does not execute or simulate a fresh send.
- Brand assets: src/app/components/Logo.tsx, public/landscape.jpg, locally built Figtree / Shadows Into Light fonts.
- Effects: HyperFrames bundled Pixabay effects; see assets/CREDITS.md.
