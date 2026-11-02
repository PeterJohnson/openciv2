# Additional game windows

Open the [four-way window review](review/other-windows/index.html), or select any
of its scenes in the [main gallery](index.html). This adds **35 scenes and 140
renders** to the existing set. Each has original artwork, replacement artwork at
native resolution, HD only, and an enhanced version. No game source, asset
loader or executable is changed.

## Coverage and evidence

All code references below refer to `C:\Projects\richardpenman-civ2`. The sibling
checkout supplies only local installed artwork and the retained saved game.

| Family | Scenes | Rendering evidence |
| --- | --- | --- |
| Advisors and reports | City Status, Attitude, Trade, Science, Defense statistics, military losses, Intelligence, Wonders, Top Five Cities, Demographics, Score, Hall of Fame | 32 unchanged function bodies compiled into `atlas-reports.exe`; `src/auto/reports.cpp`, `city.cpp`, `civ.cpp`, `graphics.cpp`, `window.cpp` |
| Civilopedia | Advance index, Railroad page, advance tree, Riflemen, Library, Pyramids, Forest | Static adapters informed by `PediaWindow::create`, `draw_frame`, `draw_item_list`, `draw_advance_page`, `draw_advance_tree`, `draw_unit_page`, `draw_improvement_page`, `draw_terrain_page` in `src/auto/pedia.cpp` |
| Further reports | Powergraph, Foreign Minister, historian ranking, casualty timeline | Static adapters informed by `powergraph_show`, `foreign_minister_show`, `historian_report_show`, `casualty_timeline_draw` in `src/auto/reports.cpp` |
| Council and endgame | High Council, Destroyed Civilizations, Credits | Static adapters informed by the `CouncilWindow` drawing methods, `DestroyedCivsWindow::create/draw_entry/draw_portrait`, and `credits_draw_scroll` in `src/auto/reports.cpp` |
| Auxiliary panels | Status, World Map | `status_draw_info/status_draw_unit_panel/status_redraw` in `src/auto/game.cpp`; `minimap_calc_layout/minimap_tile_to_screen/minimap_tile_color/minimap_redraw` in `src/auto/mapview.cpp` |
| Representative dialogs | Tax Rates, research choice, production choice, Game Options, main menu, quit confirmation, improvement-completed message | `TaxRateDialog` in `src/auto/city.cpp`; `civ_choose_research_dialog` in `src/auto/civ.cpp`; `menu_game_options` and shared dialog drawing in `src/auto/window.cpp`; `game_main_menu_loop` in `src/auto/game.cpp` |

These cover the remaining main window families and representative controls.
Every event message, scenario editor, multiplayer lobby, operating-system file
picker and animation frame is not a separate scene. Existing city, diplomacy,
spaceship, throne and map comparisons remain in the main gallery.

## Fidelity boundaries

The twelve report scenes execute extracted C++ drawing bodies. Their loops,
column positions, text spans, icon selection and ordering are unchanged. Their
city/unit glyphs are replayed through the existing extracted `gfx_draw_city` and
`gfx_draw_unit`, with original or replacement anchors as appropriate. The
standalone adapter supplies surfaces, labels, fonts, scrollbars and buttons;
it does not run the window message loop. Close, Casualties/Statistics,
Supply/Demand, Goal and Cities buttons use the corresponding source control
rectangles. Native reference font glyphs are used only for the original-art
variant. The replacements retain the smooth replacement font backend.

The other 23 scenes are **source-guided static layout adapters**, not extracted
full window implementations or pixel-equivalent runtime screenshots. They
preserve the principal source dimensions and visual conventions: the 640 × 400
Civilopedia, its two-column nine-row index and enlarged detail sprites; the
five 90 × 122 council media slots; native tax sliders and locks; the source
powergraph axes and sampling cadence; and the staggered minimap projection.
Native window borders, generic dialog autosizing, animation, input/focus states,
complete Civilopedia link layout and runtime reflow remain adapter boundaries.
The first three variants share one layout specification. The enhanced variant
changes presentation separately; it makes no claim about the current engine.

The local installation lacks the council AVI files. Its original-art council
comparison therefore shows the source frame with empty black media slots and
fixture speech. It is explicitly incomplete as an original media comparison.
Replacement versions use independently created still advisor portraits.
Arrival/wonder movie playback is outside this static set; no unrelated original
art is substituted for missing video. Destroyed Civilizations uses the local
original `mk.dll` background and portrait in the original-art comparison.

The report fixtures load the retained 1788 save's packed game, civilization,
city, unit, map-header and tile records. Save and section hashes are checked at
preparation time. Economic caches are supplied at the city recalculation
boundary. Research cost, the score summary, diplomatic attitude, and Hall of
Fame rows are declared display fixtures; this is not gameplay simulation or
verification of those calculations. Intelligence targets the surviving Sioux,
rather than an eliminated civilization with no capital. The world-map panel
uses the same 9,000 saved tiles and 69 cities with fog disabled for review.

The static report histories, status values, foreign relations, credits and
dialog contents are illustrative display fixtures. They are not presented as
historical events from the save. Civilopedia stats and icon categories come
from the supplied rules, with short authored explanatory text. Source hashes,
fixture layouts and calculation boundaries are recorded in the files linked
below. Report pages that naturally scroll show the initial page.

## Additional presentation proposals

HD only keeps every logical rectangle, sprite size and native layout rule. It
loads the retained higher-resolution replacement art and renders smooth fonts
at two physical pixels per logical pixel. It does not change zoom, list capacity
or information density.

The enhanced windows demonstrate quieter panel fills, reduced text shadow,
clearer selected rows, separated tree links, more legible dense military counts,
slider fill and an active-council cue. These changes are confined to the review
renderer. A scoped engine upgrade could implement them with:

1. One density-aware drawing surface and common button/scrollbar styles.
2. Measured column widths, wrapping and per-cell clipping for long localized
   labels and three-digit unit counts. Preserve the data selection loops.
3. Semantic panel backgrounds and selection states, with the existing sprites
   and reference logical coordinates retained as defaults.
4. A shared world-map projection with explicit visibility input and a separate
   selection outline. Do not use the full detailed tile renderer for this panel.
5. Still portrait support for the council, plus optional sprite/video animation
   inside its existing slots. Media availability should be independent of layout.

These extend the [scoped renderer recommendations](RENDER-UPGRADES.md). None
requires a 3D renderer or changes the map simulation.

## Build and validation

Viewing the checked-in PNGs requires no original game installation. Rebuilding
the original-art comparisons does. From the target repository, using the same
Python/Pillow, Node/Sharp and MSVC x86 environment as the existing review tools:

```powershell
& tools/atlas-review/build-engine.ps1 -Configuration Release
& tools/atlas-review/build-engine.ps1 -Configuration Debug
& tools/atlas-review/build-reports.ps1 -Configuration Release
& tools/atlas-review/build-reports.ps1 -Configuration Debug
python tools/atlas-review/prepare-report-inputs.py --game C:/Projects/civ2/Civ2 --save C:/Projects/civ2/Civ2/midgame1/he_a1788.sav
python tools/atlas-review/prepare-other-inputs.py --game C:/Projects/civ2/Civ2
node tools/atlas-review/build-other-windows.cjs
node tools/atlas-review/verify-other-windows.cjs
node tools/atlas-review/verify.cjs
```

The existing original-art bindings must also have been prepared as described in
[README](README.md#original-game-art-comparison). Run the two input preparation
commands in the listed order. `build-other-windows.cjs --gallery-only` refreshes
the indexes from retained renders without rerendering them.

- [Report extraction and source hashes](review/report-extraction.json)
- [Static adapter sources and limits](review/other-windows/source-adapters.json)
- [Saved-state provenance and supplied values](review/fixtures/other-windows/inputs.json)
- [Static layout fixtures](review/fixtures/other-windows/static-layouts.json)
- [Dimensions, artifact hashes and Debug/Release checks](review/other-windows/validation.json)

Validation covers report and city/unit glyph trace equality in Debug/Release,
all 140 image dimensions, shared native/HD layouts, required buttons, source
hashes, adapter asset resolution and game-source isolation. Visual inspection
checks the rendered pages. This is source/integration validation; it does not
claim runtime screenshot parity or interactive behavior qualification.

Only composed original-art scenes are retained in `review/original-scenes`.
Extracted sheets, backgrounds and icons remain ignored under
`review/original-local`. They are excluded from the replacement asset manifest
and license, consistent with the user's scene-only distribution allowance.
