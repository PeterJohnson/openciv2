# Standalone renderer audit

The source is **this repository**, `richardpenman-civ2`, at `bd89036`; no renderer
from the sibling `C:\Projects\civ2` project is used. The latter supplies only scratch storage and the read-only gameplay save/rules
inputs; none of its renderer code is used. [Extraction metadata](review/engine-extraction.json)
pins the source file hashes, function names, source line numbers and body hashes.

## What is compiled

`tools/atlas-review/extract-engine.py` extracts 45 complete function bodies
without rewriting them, apart from LF normalization and added `#line` mappings.
It also copies seven named table initializers plus the city wonder-slot pool.
The result compiles as MSVC x86 in Debug and Release. The extraction is performed
from the current checkout; it is not an approximate JavaScript port of the
baseline map selection logic.

| Source | Relevant functions and observed contracts |
| --- | --- |
| `src/auto/mapview.cpp:1356` | `update_layout`: 64×32 logical terrain, 64×48 unit/city frames, viewport overdraw and integer zoom dimensions |
| `src/auto/mapview.cpp:1490` | `tile_to_screen`: staggered projection, origin, margins and horizontal wrap |
| `src/auto/mapview.cpp:1507` | Ocean: four 32×16 quarters, eight states each; river mouths from diagonal neighbors |
| `src/auto/mapview.cpp:1549` | Land: base, neighbor dither, terrain features, farms, rivers and shields |
| `src/auto/mapview.cpp:1687` | Nine road sprites and nine rail sprites: isolated plus eight directional arms; city endpoints and remembered improvements |
| `src/auto/mapview.cpp:1892` | Terrain visibility, real/remembered improvement selection and native zoom cutoffs |
| `src/auto/mapview.cpp:2014` | City and unit visibility/stack selection helpers |
| `src/auto/mapview.cpp:2174` and `2382` | Terrain → city → unit → grid **per tile**, then city names; alternating staggered row widths |
| `src/auto/map.cpp:3338` and `6445` | Coast quarter bit masks and horizontal wrap |
| `src/auto/graphics.cpp:1938` | Scale is `(zoom + 8) / 8`, with source integer arithmetic; map zoom controls allow -7…8 |
| `src/auto/graphics.cpp:2955`, `3237` | Unit shields/health/order display and city style/size/walls selection |
| `src/auto/city.cpp:4368`, `4451`, `4647` | Site classification, seeded building placement, slot draw order and native art rectangles |
| `src/auto/reports.cpp:4103` | Throne resource selection, exact crop rectangles, draw positions and interleaved bonus layers |
| `src/game/random.cpp`, `src/auto/support.cpp` | Unchanged cosmetic RNG and seed setter used by city layout |

Source references above describe the inspected revision; the JSON record is the
authoritative function/line index. `Sprite::blit_to_surface` at
`src/auto/graphics.cpp:8707` was also read: it applies trimmed bounds, offsets,
palette-keyed row blitting, clipping and a scaled-size guard below 1,025 pixels.
That legacy DIB backend is deliberately the replacement boundary, not a claimed
part of the compiled standalone renderer.

## Explicit adapter boundaries

- `engine-shim.h` supplies finite fixture state and records drawing operations.
  It retains the source's 60-byte sprite stride and required city-view offsets
  with x86 static assertions. The throne rectangle tables share adjacent backing,
  as required by source pointer arithmetic. Fixtures are supplied continuations,
  not initialized gameplay sessions.
- Map layout, projection and row traversal execute the actual source functions.
  The fixtures specify a camera through its equivalent center and viewport size.
  `update_layout` supplies the additional rows needed to cover the viewport.
- An explicitly backed empty-stack sentinel has owner 0 and no visibility.
  Inactive fixture units are unselectable. No unspecified neighboring allocation
  is used to determine whether an empty tile draws a unit.
- The PNG adapter supplies full untrimmed frames with zero offsets, native box
  sizes, and new art-specific flag/label/shield anchors. It does not reproduce
  the original indexed palette, trimmed sprite storage or binary row blitter.
  Palette replacement is represented by designated colors in the review backend.
  Antialiasing, resampling and alpha compositing are newly supplied.
- Map font metrics are deterministic fixture approximations; glyphs use a
  substitute font. Window chrome, city-name labels, input/picking masks, combat
  animation, networking, sound and optional extra UI are not runtime-qualified.
  The fixture disables those optional paths. The delivered fonts are catalog
  resources, not a claim of original GDI text equivalence.
- City panorama content uses actual site-dependent slot selection, cosmetic
  random numbers, art crop dimensions and draw order. New background plates and
  building crops supply the pixels. The native panorama is 1280×480; the window's
  horizontal scroll presentation is outside the fixture.
- Throne content uses the actual resource order, `x-1/y-1` draw positions, crop
  sizes and bonus conditions in a 640×480 surface. The new furnishing assignments
  are explicit art bindings, not evidence about the original subjects in each
  resource. The background is supplied separately, as the surrounding source
  setup loads the base resource outside `render`.

The appropriate claim is **source-derived selection, layout and ordering with a
replacement PNG backend**. It is not original-game pixel equivalence, a full game
build or an integration test. This distinction applies equally to legacy and
HD-only previews, so their comparison isolates resolution rather than changing
placement or scene content.

## Direction and layer contracts

The game orders its eight directions **NE, E, SE, S, SW, W, NW, N**. The authored
complete connection bank orders them **N, NE, E, SE, S, SW, W, NW**. Conversion is
an eight-bit rotate left by one. The standalone verifies all 256 conversions.
Four-bit river neighbors are NE, SE, SW, NW.

The source road pass counts connections to remembered neighbor bits `0x12`;
rails use `0x22`. A city is a rail-capable endpoint even when the current tile
does not carry a separate rail bit. Mixed road/rail joins must retain this
behavior. A city does not receive an isolated transport dot. Unknown neighbors
must never acquire connections merely because the renderer can access real
terrain or improvement storage.

An ocean tile chooses four independent three-bit quarter states from its eight
neighbors. These are different from the proposed continuous field and from the
four-corner authoring bank; one cannot substitute their indices directly.
Current coast quarters are newly authored to the native 32×16 topology.

Native detail gates are intentionally visible in both baseline stages: coast
quarters at zoom ≥ -3; terrain dither at ≥ -4; roads, most improvements and
special resources at ≥ -3; special overlays at ≥ -4; rivers at ≥ -6. The proposed
world overview is a separate rendering policy, not an accidental change to those
source conditions.

## Validation and remaining limits

[Validation results](review/validation.json) record:

- 512 source road/rail cases, 256 coast neighborhoods, 16 zoom levels, two
  remembered-state cases and one city endpoint case, with identical Debug and
  Release command traces;
- fresh Debug/Release equality for every saved main scene trace;
- canonical paths, hashes and master references, all 5,173 inventory replacement
  references, 404 PNG compatibility bindings and all 66 three-stage images;
- direction conversion and focused proposed-renderer visibility isolation.

These are finite renderer/asset checks. They do not establish all possible unit
stack, combat, editor, scenario or multiplayer behavior. No application source
has changed, so a full game runtime regression would not qualify this art-side
prototype. Future integration must test actual font metrics, input transforms,
wrapped maps, ownership/visibility transitions and resource-loader completeness.

## Window renderer extension

`extract-windows.py` runs the map/scene extractor and adds **24 unchanged bodies**
to a second MSVC x86 executable, `atlas-windows.exe`. Together the executables
compile 69 source bodies. [Window extraction metadata](review/window-extraction.json)
pins their actual source paths, lines and hashes. There is no dependency on the
sibling project's renderer.

| Window | Source behavior executed | Explicit review boundary |
| --- | --- | --- |
| Diplomacy | `init_main_art`, `init_military`, `science_rank_top_techs`, `init_science`, `init_portrait` in `src/auto/diplomacy.cpp:4629–5047` | Static audience only; GIF/palette/window allocation become PNG commands. Technology category/name data and text shaping are supplied. No AVI herald or diplomacy decision-dialog execution. |
| Spacecraft | `render_ship_init_rows`, `render_ship_load_surfaces`, `render_ship_draw_part`, `render_ship` in `src/game/bigframes.cpp:587–1563` | All 88 source rows, count thresholds, filled/empty resource choices and layer order execute. The 457×304 framebuffer at `(175,99)` is flattened for PNG output. Palette, lifetime, title, stats text and controls are drawing adapters. Stats are declared fixture values, not a spaceship simulation. |
| City management | `scale`, `set_scaled_rect`, `layout_rects`, `draw_all`, `draw_info_panel`, `draw_citizens`, `draw_citizen_row`, `draw_resource_yields`, `draw_food_box`, `draw_production`, `draw_supported_units`, `draw_improvements` and `city_window_draw_icon_row` in `src/auto/city.cpp` | Native 636×421 content at `view_scale=2`. Supplied city population, moods, stockpiles, building, unit and improvement state. Map terrain and economy totals panel, units-present details, controls, window chrome and font metrics are marked adapters. Other info modes throw rather than invent a result. |
| Spacing | `ui_calc_item_spacing` in `src/auto/window.cpp:4031` and `sprite_draw_spaced_row` in `src/auto/graphics.cpp:2710` | Real overlap, fit and remainder arithmetic for citizens and stockpile icons; the new backend supplies sprite pixels. |

The diplomacy source uses government resources `200 + government`, military
resource 215 with era columns at `era*109+1`, 108×30 rows spaced by 31 pixels,
and a 225×275 portrait at `(208,57)`. Its technology column begins at `(485,130)`
with a 58×20 text region at `(531,137)`. The source word-wrap helper reads prior
buffer contents in one branch; this review explicitly substitutes deterministic
fixture text instead of pretending to recover that state. The six advance IDs,
depths and categories are fixture inputs, not reconstructed research progression.

The spacecraft renderer is in **`src/game/bigframes.cpp`**, not the modal-loop
file alone. Core rows 0–6 precede the selected structural frame from rows 7–30;
part rows 31–87 follow it. Original crop rectangles select new part artwork;
the truss graphic is newly authored. Current and HD-only preserve every selected
rectangle and order. The recommended layout deliberately replaces the split-crop
art contract with one component per attachment port. `space-layout.json` is this
**proposed** metadata, not a recovered native layout. Structural readiness and
part counts stay explicit; gameplay limits and launch rules are not changed.

The city adapter's 21 ordered tile positions follow
`src/data/gamedata.cpp:1736–1737` and `draw_resource_map`/`draw_resource_tiles`.
Its worked flags and food/shield/trade values are supplied fixture data, read
from the fixture file. The unchanged `draw_resource_yields` body draws their
10×10 icons with native centering and overlap. Its direction and display tables
are extracted from `gamedata.cpp`. Full city yield recalculation, economy summary
rows and the units-present detail panel remain adapters. The native list and stockpile functions do execute, including compressed
icon spacing at population 28. Optional extras and interactive hit testing are
outside this fixture. A full game build remains the future integration test.

The word **Legacy** means replacement art at native drawing resolution, never
original-game pixels. Legacy and HD-only window stages consume the same native
trace and identical logical artwork rectangles; only physical density changes.
The gallery notes these limits so they cannot be mistaken for gameplay captures.

## Map object size contract

For logical tile widths of 48 pixels and above, the proposal replays a separate
native object trace from `draw_tile_city` and `draw_tile_units`. It uses the same
64×48 logical unit/city frames, selected sprite IDs, zoom arithmetic, anchors,
shields, health bars, flags and population labels as HD-only. It no longer fits
units to half a tile or cities to 82% of a tile. Ground/network/feature passes
still change; overview markers below 48 pixels remain an explicit LOD policy.
The tactical 64-pixel and close/district 128-pixel scenes exercise this contract.
Fresh Debug/Release object traces and matching visible sprite rectangles are
checked by `verify.cjs` and saved beside the other traces.

## Semantic economy binding audit

`docs/screenshots/city.png` was inspected for meaning and presentation only; it
is never composited or sampled. `src/auto/graphics.cpp:854–895` defines separate
14×14 resource and rate symbols and a contiguous 10×10 food/shield/trade bank.
`src/auto/city.cpp:12821–13419` uses separate food, shield, trade, coin and science
rows; `14186` uses the coin in the improvement list. The prior review incorrectly
bound several of these to the mixed grassland special or gold ore.

`economy.cjs` authors four SVG silhouettes and PNGs and retains the fuller
painted wheat for food and a painted antique gold coin. Native food/production,
supported-unit upkeep, improvement coins, economy rows and worked-tile overlays
bind to the corresponding symbol. Proposed meters retain the same symbols.
The fixture still supplies values; this correction does not claim city simulation
or exact reproduction of the screenshot's fonts, art or summary-row layout.

## Real gameplay save boundary

The map import is the actual `he_a1788.sav`, read from the local game's
`midgame1` save directory, with numeric style/domain/hit-point data from its
`RULES.TXT`. The files are read-only and are not distributed. The committed
`saved-world.json` records input SHA-256 values, section offsets/hashes, source
hashes and the complete imported map/records needed for replay. Units with zero
IDs are free slots: 223 of 290 allocated records are live; all 69 cities are live.

The parser follows this checkout's `tools/xdnet/savecmp.py`, `civ2types.h`,
`save_read_game`, `save_read_units_cities` and `map_read`; support is deliberately
limited to the observed version-44 normal-save layout. Cameras are selected
deterministically for varied developed terrain. No tile or object is added to
improve composition. All three stages explicitly use the same all-map view;
fog is disabled for art inspection rather than represented as player knowledge.

Four additional unchanged bodies run in the `save_native` namespace:
`tile_resource`, `tile_has_hut`, `tile_grassland_has_shield` and
`unit_stack_pick_display_unit`. Imported resource/hut/shield flags are checked
against those source formulas over all 9,000 cells in Debug and Release. The
adapter supplies validated stack links, tile owners, civ advances, city
improvements and unit stats; source selection chooses city size/style/walls,
top unit, health and stack badges. Proposal ground lookups wrap horizontally. The grassland production overlay
uses the same shield silhouette; detailed proposed maps retain those markers
and source-selected huts.
The coin is a raster-art replacement within the existing native 14-pixel boxes;
HD-only changes image density, while tax and improvement-list semantics stay the same.

This remains a render-state replay. Map labels, original palette colors, order
glyphs, exact text metrics and interactive camera/gameplay execution remain
backend/fixture limits. The data is diverse gameplay state, not a claim that the
standalone program loads or runs the full game.
