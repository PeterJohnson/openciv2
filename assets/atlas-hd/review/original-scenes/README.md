# Original-art scene references

This directory contains composed in-game comparisons and actual execution
captures, retained with the user's authorization. The core set has 22 scenes
and four 4K exports; the additional-window review adds 35 scene renders.
The transport comparison consists of rendered map test views. The gallery's
four stages are available from a fresh checkout without installing the game.

These are original-game artwork derivatives for visual review, not replacement
assets or new artwork covered by the replacement library's license. They remain
outside the canonical asset manifest, coverage bank and compatibility bindings.
Files in `images/` are standalone source-trace replays. Files in `runtime-other/`
are actual OpenCiv2 execution captures with original artwork and lossless window
crops; they are not captures of the legacy 1999 executable.
[Runtime comparison](../fidelity.html) shows confirmed differences in typography,
panels and omitted overlays; [the audit](../../FIDELITY-AUDIT.md) defines the
remaining work before a pixel-equivalence claim.

- `images/`: composed scene PNGs at the original renderer dimensions.
- `4k/`: presentation resamples of selected scenes; no additional source detail.
- `renders.json`: core scene paths, dimensions and SHA-256 hashes.
- Additional-window renders are indexed in [scenes.json](../other-windows/scenes.json).
- `runtime-other/`: 11 unmodified execution captures and 12 window crops, with
  [comparison and provenance](../other-windows/runtime-audit.html).
- `data.js`: the same render index for the offline gallery.

Source GIFs, DLLs, extracted sprites, binding tables, extraction traces and
citizen contact sheets stay in the ignored `../original-local/` directory.
Do not add them here. To regenerate, follow the
[original-art rebuild instructions](../../README.md#original-game-art-comparison).
