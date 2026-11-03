# Additional game windows

The [four-way review](review/other-windows/index.html) contains **35 scenes / 140 renders**.
All original-art, replacement-native and HD-only scenes now execute extracted
game rendering code from `C:/Projects/richardpenman-civ2`. The enhanced proposals
remain separate. Report presentation and Civilopedia controls have been refined
in the enhanced set; no game source or loader is modified.
The [report refinements](review/other-windows/report-refinements.html) show the
aligned backgrounds, larger wonders and individual advance illustrations.

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

## Report backgrounds and enhanced presentation

`report-design.cjs` builds 27 independent PNG/SVG background plates from the
extracted row positions. City Status, Attitude and Trade bands follow their
24/32-pixel text rows and connect to the corresponding staggered city. Defense
and casualties use the same treatment for units. Science and Intelligence use
22-pixel advance rows. Other report headers and panels fit their actual content,
replacing the generic oversized title panel and unrelated horizontal divisions.

The native/HD plates change only the background. They demonstrate what a
background replacement can achieve at the supplied logical size and font metrics.
City, Attitude and Trade include even/odd scrolling alternatives: the game derives
the icon column from the absolute list index, so scrolling one row flips the
stagger. Selecting the matching plate needs a small loader/render change; a
single static image cannot follow both phases. Resizing or changing font metrics
also needs matching plates or dynamic bands. Top Cities and Hall of Fame share
resource 57 and deliberately retain identical native plates. Defense/casualties
share resource 51 with other history views, requiring per-window selection for
their specialized patterns. See [plate metadata](interface/reports/layout.json).

The original source selects advance icons with `category * 4 + epoch`: 20
era/category symbols, not a unique symbol for every advance. The standalone
report fixture previously omitted `epoch`; supplying the actual RULES.TXT field
corrects the Science and Intelligence baseline icons without changing source
layout. These are the only original report PNGs changed by this refinement.
Enhanced Science and Intelligence, Civilopedia and research selection now share
56 distinct existing Atlas illustrations for their displayed advances, with exact
rule IDs and asset hashes in [the mapping](interface/reports/knowledge.json). Unmapped
advances stop explicitly; this is not yet a complete advance-icon catalog.

Enhanced Defense has larger Active, Building and Abilities headings. Casualties
labels the civilization columns, centers the counts and widens the primary
bracket to contain them; these are losses by civilization, not kills or production.
Top Cities enlarges wonders inside their existing row frames. All seven enhanced
Civilopedia views now take button labels, rectangles and disabled state from the
source traces, including the unavailable Description action.

`other-windows.cjs` writes only the 23 separate enhanced proposals; `report-render.cjs`
owns the twelve report scenes. The ordinary baseline refresh preserves enhanced
PNGs. Explicit proposal rebuilds are listed below. The proposals make no claim
about current-engine execution and are not included in runtime parity. See
[scoped engine recommendations](RENDER-UPGRADES.md) and
[presentation checks](review/other-windows/presentation-validation.json).

## Enhanced content parity

The [content comparison](review/other-windows/content-refinements.html) shows ten
refined enhanced scenes alongside their original-art baseline. The source-aware
adapters in `enhanced-details.cjs` consume retained traces; they do not rerun or
invent game calculations. All 105 original/native/HD PNGs stay byte-for-byte
unchanged from `16f21181`, as do the other 25 enhanced scenes.

- Civilopedia's index, Railroad detail and focused tree use the shared advance
  illustrations. The detail restores Banking as the additional prerequisite for
  Industrialization and uses Darwin's Voyage's actual wonder binding. The tree
  remains a focused immediate-prerequisite/successor proposal, not the full
  native ancestry tree. Forest includes every source field: movement, defense,
  yields, irrigation/mining effects and turns, transformation, roads and resources.
- Foreign Minister uses the source contact list, power/reputation sentence and
  Check Intelligence / Send Emissary / Cancel actions. This save exposes one
  contact; the earlier five invented contact cards are removed.
- Status shows the actual saved Knights with moves, home city, owner, veteran
  status and tile, plus the source empire totals. Unit drawing reuses the native
  saved-unit path, including its display flags; no substitute units or orders.
- Tax Rates uses the source 40/60/0 allocations, 215 income, 238 cost and 7-turn
  research estimate. Icons are anchored beside their labels and clear both
  endpoint text and sliders. The zero-luxury case draws an empty fill correctly.
- Research displays all seven available source choices with the shared icons
  and Help / Goal / OK order. Production displays all sixteen visible source
  choices, their turn estimates, unit attack/defense/move and HP/firepower values,
  selection and Auto / Help / OK actions. Its taller enhanced table gives those
  fields space; original and HD geometry remains fixed.
- Destroyed Civilizations places dark panels behind its portrait and text and
  uses the source's A.D. 1595 conquest date for the declared Romans fixture.

These are initial-frame content checks, not interactive-runtime qualification.
The [validation record](review/other-windows/content-validation.json) covers
source content/control order, text fit, tax-icon clearance, saved glyph D/R
agreement and unchanged baseline/unrelated image hashes.

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
node tools/atlas-review/other-windows.cjs
node tools/atlas-review/report-render.cjs
node tools/atlas-review/build-other-windows.cjs --gallery-only
node tools/atlas-review/review-report-design.cjs
node tools/atlas-review/review-window-content.cjs
node tools/atlas-review/build-other-runtime-audit.cjs
node tools/atlas-review/verify-other-windows.cjs
node tools/atlas-review/verify.cjs
```

`build-other-windows.cjs --gallery-only` refreshes indexes without rerendering.
`other-windows.cjs` rebuilds the 23 enhanced non-report proposals;
`report-render.cjs` rebuilds all four report variants and their background plates.
`review-report-design.cjs` rebuilds the focused review and checks row connections,
source-matched controls, distinct illustration assets and the allowed baseline
icon corrections against commit `2be877c9`.
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
