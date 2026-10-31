# Original-art scene references

This directory contains only the 22 composed in-game scene comparisons and
their four 4K presentation exports, checked in with the user's authorization.
The transport comparison consists of rendered map test views. The gallery's
four stages are available from a fresh checkout without installing the game.

These are original-game artwork derivatives for visual review, not replacement
assets or new artwork covered by the replacement library's license. They remain
outside the canonical asset manifest, coverage bank and compatibility bindings.
The renders use standalone source-trace replays with the documented panel/text
adapters; they are not screenshots of a running original game.

- `images/`: composed scene PNGs at the original renderer dimensions.
- `4k/`: presentation resamples of selected scenes; no additional source detail.
- `renders.json`: scene paths, dimensions and SHA-256 hashes.
- `data.js`: the same render index for the offline gallery.

Source GIFs, DLLs, extracted sprites, binding tables, extraction traces and
citizen contact sheets stay in the ignored `../original-local/` directory.
Do not add them here. To regenerate, follow the
[original-art rebuild instructions](../../README.md#original-game-art-comparison).
