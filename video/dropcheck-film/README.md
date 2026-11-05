# Dropcheck demo film

48 seconds · 1920×1080 · 30 fps · HyperFrames 0.8.223.

- `renders/dropcheck-demo.mp4` — final narrated video with music.
- `renders/dropcheck-demo-music-draft.mp4` — earlier music-only draft.
- `index.html` and `compositions/` — editable video source.
- `SOURCES.md` — source links and asset provenance.
- `NARRATION.md` — optional timed voice script.
- `REVIEW.md` / `check-report.json` — review and validation.

From this directory:

```sh
hyperframes preview --background
hyperframes check --json
hyperframes render --quality delivery --fps 30 --workers 2 --output renders/dropcheck-demo.mp4
```

The final version uses Kokoro open-source narration, reused HeyGen catalog music, and bundled sound effects. It contains actual read-only app captures and references a prior verified testnet run. It does not execute a fresh transaction.

To regenerate the free narration from the repository root:

```sh
python3 video/generate-free-voice.py
python3 video/finalize-narration.py
```

The voice generator calls the model author's public CPU demo, with two concurrent requests. The local runner in `generate_local_voice.py` is an alternative when the model weights and kokoro-onnx are installed. No paid voice subscription is needed.
