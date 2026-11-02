# Additional game windows

The [four-way review](review/other-windows/index.html) contains **35 scenes / 140 renders**.
All original-art, replacement-native and HD-only scenes now execute extracted
game rendering code from `C:/Projects/richardpenman-civ2`. The enhanced proposals
remain separate and their PNGs are unchanged. No game source or loader is modified.

The [execution comparison](review/other-windows/runtime-audit.html) compares twelve
scenes with actual OpenCiv2 execution using the same original artwork and 1788 save.
Its [manifest](review/other-windows/runtime-audit.json) retains build/executable/save
hashes, source identity, unmodified captures, crop coordinates and limitations.
This is **OpenCiv2 execution, not the legacy 1999 executable**. Capture scaling,
focus/cursor state, panel dimensions and runtime extras prevent a pixel-identity claim.

## Extracted rendering coverage

`atlas-reports.exe` compiles 32 unchanged report bodies. `atlas-other.exe` compiles
258 further unchanged bodies, preserving original class/global layouts and source
line mappings under MSVC x86. The existing `atlas-engine.exe` supplies extracted
city/unit drawing, including a saved-unit mode that preserves owner, damage,
orders and stack state. These counts are separate extraction sets, not a claim
of 290 unique functions across binaries.

| Family | Scenes | Executed source |
| --- | --- | --- |
| Reports | City Status, Attitude, Trade, Science, Defense, military losses, Intelligence, Wonders, Top Five Cities, Demographics, Score, Hall of Fame | Report selection/layout in `src/auto/reports.cpp`; city, civilization and glyph helpers |
| Civilopedia | Advance index, Railroad page/tree, Riflemen, Library, Pyramids, Forest | `PediaWindow::create`, index loading/sorting, control updates, detail pages, links and connectors in `src/auto/pedia.cpp` |
| Further reports | Powergraph, Foreign Minister, historian, casualty timeline | `powergraph_show`, `foreign_minister_show`, `historian_report_show`, `casualty_timeline_show/draw` in `src/auto/reports.cpp` |
| Council/endgame | High Council, Destroyed Civilizations, Credits | Council background/buttons; destroyed entry/portrait; `credits_draw_scroll` |
| Auxiliary panels | Status, World Map | `status_redraw` and status helpers in `src/auto/game.cpp`; minimap layout/projection/color/redraw in `src/auto/mapview.cpp` |
| Dialogs | Tax Rates, research, production, Game Options, main menu, quit confirmation, improvement-completed message | `TaxRateDialog::run/paint/calc_totals`, research/production option selection, shared `Dialog` text parsing, autosizing, columns, list/options, sprites and buttons |

Frames use extracted `FrameWindow::create/layout/draw_frame_borders/draw_caption`
and `PictureWindow::open`. Original and HD-only geometry is no longer a hand-built
static layout. The HD replay uses the same logical commands at twice the physical
resolution, authored replacement art and smooth replacement fonts. Original-art
replay retains the reference bitmap fonts. Native replacements also keep the
replacement font backend.

## Execution comparison and corrections

The running build is `bd89036fc339f0c44f7788b17f9765c377cc8a55`.
All recorded rendering-source and font inputs are compared with that revision;
line endings are normalized for source, while font bytes are compared directly.
The executable was run from an isolated local copy with the original installation
and `he_a1788.sav`. No changes were made to that save or the game source.

The comparison covers four Civilopedia pages, tax rates, Foreign Minister,
casualty timeline, options, quit confirmation, main menu, world map and status.
It corrected double-scaled Civilopedia sprite dimensions, the quit icon,
scrollbar theme/geometry, background texture phase, blank lines in the label
table and the active unit's saved-state forwarding. Tax income **215**, upkeep
**238** and research **7 turns** now come from extracted calculation routines and
agree with execution. Existing source label overlaps and long-heading clipping
are retained in baseline previews.

Source/integration verification covers all 35 scenes. Runtime evidence covers
the twelve listed above, with per-scene differences in the comparison. The other
23 scenes are explicitly uncaptured, not implicitly runtime-qualified.

## Standalone boundaries and supplied state

The harness runs drawing to a completed initial frame, not an interactive message
loop or complete game simulation. Its device boundary records surfaces, sprites,
text and controls. Original scrollbar pixels are read from the game's
`src/platform/scroll_theme.h`; the geometry follows `controls.c`. Reference
bitmap metrics drive layout. Replacement font rasterization deliberately differs.
Native focus outlines, hover/pressed state and cursor effects are outside this
initial-paint boundary. Wrapped endgame text uses a finite word-wrap adapter.

`Dialog::create_controls` is a finite driver of the extracted radio/checkbox,
scrollbar and button creation methods. Radio-item painting and platform control
creation are device adapters; edit fields and multiple sprite controls stop
explicitly. Unknown scenes and unbound operations fail instead of inventing output.

The fixture loads packed game, civilizations, cities, units, map header and tiles
from the retained save. It also loads the actual 1,200-byte power history and
9,000-byte English visibility plane. Local rules and original text files supply
labels/dialog sections; physical blank lines in LABELS.TXT are preserved.
Complete original text/media inputs stay ignored. Their hashes are retained.

- The minimap uses saved visibility and center `(13,105)`, with a declared review
  panel of 256 × 168 and viewport bounds. Status uses a 256 × 900 panel and the
  saved active Knights. Runtime panels differ slightly in size. Runtime extras
  show Turn 370; baseline extras are disabled.
- The twelve older reports retain documented city economic caches, score,
  research-cost and Hall of Fame fixtures. Tax Rates now executes its calculation
  plus `city_split_trade` and `civ_research_cost`. Production uses London, source
  availability selection, saved shield total, ten shield rows and a declared
  zero support cache; it does not run full city recalculation.
- Foreign Minister supplies the saved attitude at the AI evaluation boundary.
  Historian randomness is deterministic (Herodotus/wealth); ranking is source
  code. The casualty log is empty, as in the execution capture.
- The scenario directory has no DESCRIBE.TXT. Civilopedia uses source detail
  behavior and rules without inventing a descriptive paragraph.
- Council AVIs are unavailable locally. Its original source frame has empty
  black media slots; replacement art uses independent still portraits. No
  fabricated council speech or substitute original video is presented.
- Destroyed Civilizations uses a declared Romans entry at turn 320 and the
  source year table, entry/portrait drawing and frame coordinates. It does not
  run the endgame movie lifecycle. Credits shows the first scroll frame of the
  local CREDITS.TXT with its leading blank lines, not a fabricated credit list.

## Enhanced proposals

`other-windows.cjs` is retained solely for the independent enhanced proposals;
it cannot write original/native/HD outputs. Its illustrative layouts and values
are recorded as enhanced metadata. The ordinary baseline refresh preserves
enhanced PNGs byte-for-byte. The proposals still demonstrate measured columns,
quieter fills, clearer selection, sprite-based controls and still council
portraits. See [scoped engine recommendations](RENDER-UPGRADES.md). They make
no claim about current-engine execution and are not included in runtime parity.

## Build and verify

Viewing checked-in renders/captures needs no original installation. Rebuilding
original comparisons requires the local inputs and existing original bindings
described in [README](README.md#original-game-art-comparison), MSVC x86,
Python/Pillow and Node/Sharp. From this repository:

```powershell
python tools/atlas-review/prepare-report-inputs.py --game C:/Projects/civ2/Civ2 --save C:/Projects/civ2/Civ2/midgame1/he_a1788.sav
python tools/atlas-review/prepare-other-inputs.py --game C:/Projects/civ2/Civ2
python tools/atlas-review/prepare-native-other.py --game C:/Projects/civ2/Civ2 --save C:/Projects/civ2/Civ2/midgame1/he_a1788.sav
& tools/atlas-review/build-engine.ps1 -Configuration Release
& tools/atlas-review/build-engine.ps1 -Configuration Debug
& tools/atlas-review/build-reports.ps1 -Configuration Release
& tools/atlas-review/build-reports.ps1 -Configuration Debug
& tools/atlas-review/build-other.ps1 -Configuration Release
& tools/atlas-review/build-other.ps1 -Configuration Debug
node tools/atlas-review/build-other-windows.cjs
node tools/atlas-review/build-other-runtime-audit.cjs
node tools/atlas-review/verify-other-windows.cjs
node tools/atlas-review/verify.cjs
```

`build-other-windows.cjs --gallery-only` refreshes indexes without rerendering.
`node tools/atlas-review/other-windows.cjs` explicitly rebuilds enhanced proposals.
Execution captures are retained evidence, not generated screenshots; the runtime
audit builder crops them without retouching and rebuilds their comparison page.

- [Report extraction](review/report-extraction.json)
- [Further-window extraction and per-body hashes](review/other-window-extraction.json)
- [Saved-state/report fixture provenance](review/fixtures/other-windows/inputs.json)
- [Additional local-input hashes and save sections](review/fixtures/other-windows/native-inputs.json)
- [Enhanced layout fixtures](review/fixtures/other-windows/enhanced-layouts.json)
- [Artifact hashes, D/R checks and isolation](review/other-windows/validation.json)

Only composed original-art scenes and actual execution captures are retained
under `review/original-scenes`, as authorized for review. Original sheets, crops,
full text files and extracted icons remain ignored under `review/original-local`
or `build`. They are excluded from the replacement asset manifest/license.
