# Standalone renderer audit

The source is **this repository**, `richardpenman-civ2`, at `bd89036`; no renderer
from the sibling `C:\Projects\civ2` project is used. The latter supplies only scratch storage and the read-only gameplay save/rules
inputs; none of its renderer code is used. [Extraction metadata](review/engine-extraction.json)
pins the source file hashes, function names, source line numbers and body hashes.

## What is compiled

`tools/atlas-review/extract-engine.py` extracts 50 complete function bodies
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

## Runtime screenshot comparison

[The fidelity audit](FIDELITY-AUDIT.md) compares four checked-in native OpenCiv2
runtime screenshots with the corrected original-art mockups. Original-art text uses
the reference glyph bank, diplomacy fitting and city economy helpers execute
unchanged, and map names/panorama titles are restored. Those fixtures are not
identical game states, so no whole-image error percentage is reported.
[Open the paired scenes and text details](review/fidelity.html). Spacecraft and
throne runtime parity remain unverified; no fresh capture was obtained.

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
- Original-art text uses the repository's indexed reference font bank and drawing
  advances. Replacement-native/HD use smooth replacement fonts fitted to those
  logical spans and clips. Enhanced text retains its independent design backend.
  City names execute unchanged source code. Window chrome, input/picking masks, combat
  animation, networking, sound and optional extra UI remain outside this fixture.
- Native and HD-only city panorama content uses actual site-dependent slot
  selection, cosmetic random numbers, art crop dimensions and draw order. New
  background plates and building crops supply the pixels. The enhanced panorama
  retains source-selected content but applies explicit relative sizes, silhouette
  clearance, ground-contact ordering and separate wall layers. The native panorama is 1280×480; the window's
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
  references, 404 PNG compatibility bindings and all 66 replacement-stage images;
- direction conversion and focused proposed-renderer visibility isolation.

These are finite renderer/asset checks. They do not establish all possible unit
stack, combat, editor, scenario or multiplayer behavior. No application source
has changed, so a full game runtime regression would not qualify this art-side
prototype. Future integration must test actual font metrics, input transforms,
wrapped maps, ownership/visibility transitions and resource-loader completeness.

## Window renderer extension

`extract-windows.py` runs the map/scene extractor and adds **30 unchanged bodies**
to a second MSVC x86 executable, `atlas-windows.exe`. Together the executables
compile 80 source bodies. [Window extraction metadata](review/window-extraction.json)
pins their actual source paths, lines and hashes. There is no dependency on the
sibling project's renderer.

| Window | Source behavior executed | Explicit review boundary |
| --- | --- | --- |
| Diplomacy | `init_main_art`, `init_military`, `science_rank_top_techs`, `init_science`, `init_portrait` in `src/auto/diplomacy.cpp:4629–5047` | Static audience only; GIF/palette/window allocation become PNG commands. Technology category/name data is supplied; source fitting executes; original-art uses bitmap glyphs, replacements use smooth fonts in the same logical spans. No AVI herald or diplomacy decision-dialog execution. |
| Spacecraft | `render_ship_init_rows`, `render_ship_load_surfaces`, `render_ship_draw_part`, `render_ship` in `src/game/bigframes.cpp:587–1563` | All 88 source rows, count thresholds, filled/empty resource choices and layer order execute. The 457×304 framebuffer at `(175,99)` is flattened for PNG output. Palette, lifetime, title, stats text and controls are drawing adapters. Stats are declared fixture values, not a spaceship simulation. |
| City management | `scale`, `set_scaled_rect`, `layout_rects`, `draw_all`, `draw_info_panel`, `draw_citizens`, `draw_citizen_row`, `draw_resource_yields`, `draw_food_box`, `draw_production`, `draw_supported_units`, `draw_improvements` and `city_window_draw_icon_row` in `src/auto/city.cpp` | Native 636×421 content at `view_scale=2`. Supplied city population, moods, stockpiles, building, unit and improvement state. Resource terrain and economy helpers execute unchanged; source-derived present-unit/control painting and full window chrome remain explicit boundaries. Other info modes throw rather than invent a result. |
| Spacing | `ui_calc_item_spacing` in `src/auto/window.cpp:4031` and `sprite_draw_spaced_row` in `src/auto/graphics.cpp:2710` | Real overlap, fit and remainder arithmetic for citizens and stockpile icons; the new backend supplies sprite pixels. |

The diplomacy source uses government resources `200 + government`, military
resource 215 with era columns at `era*109+1`, 108×30 rows spaced by 31 pixels,
and a 225×275 portrait at `(208,57)`. Its technology column begins at `(485,130)`
with a 58×20 text region at `(531,137)`. The source word-wrap helper reads prior
buffer contents only in the branch where a multiword first word overflows.
Supported fixtures avoid that branch; the unchanged helper executes with native
metrics, including safe two-line test names. Other input labels stop unless
their caller state is qualified. The six advance IDs
now match `AdvanceId` in `src/include/enums.h`; categories use the inspected base
`RULES.TXT` values. Ranking depths remain supplied fixture input, not reconstructed
research progression. The former placeholder ID/name pairing and modulo-five
category assignment have been removed from the standalone harness.

The military column (`init_military`, `diplomacy.cpp:4670-4724`) repeats the
resource-215 crop `(era*109+1,156,108,30)` exactly `power_rank - 1` times at
`(45,130+i*31)`. It emits no per-row text. `civ_update_power_ranks`
(`src/auto/civ.cpp:2993-3077`) assigns ranks 1 through 7; it ranks overall
civilization power, with scenario-objective handling, rather than enumerating
units. The standalone input domain is corrected from 1..8 to 1..7. Explicit
`styleEra` and `powerRank` metadata preserve the meaning even when rank 1 and
zero advances produce no resource-215 draws. Source function bodies are unchanged.

Native/HD now bind the era-specific replacement military symbol, retaining
the repetition without invented unit labels. Enhanced rendering uses one emblem,
six rating segments and one label from the foreign-minister scale
(`src/auto/reports.cpp:1576-1577`, label index `0xe3 + rank`; English labels
Pathetic through Supreme). The enhanced audience label is an addition, not
original audience text. The fixture's rank 6 is Mighty: five symbols/segments.
[Military checks](review/military-validation.json) cover all 28 era/rank pairs,
exact source crop/placement/count, D/R equality, all three replacement bindings,
and eight invalid-input rejections. The original-art replay already had the
correct unlabeled repeated weapons. No new original investigation annotations
or game source edits are required for these review-adapter corrections.

The source `science_draw_tech` (`diplomacy.cpp:4778-4779`) selects
`category_sprites[advances[advance].category]`. `init_science` loads the five rows
from resource 215: categories 0/1/2/3/4 use sheet Y 32/63/94/1/125 and X
`era*109+1`. Native and HD-only replacements map those crops to the retained
military/economy/society/science/exploration artwork. There is no missing-file
fallback that silently substitutes the same icon for all categories.

The enhanced backend binds a distinct image to each of the six supplied advance
IDs. The resource command carries that ID explicitly alongside the unchanged
source rectangle, avoiding label-string or row-position inference. The supported
fixture IDs are Banking 6, Electricity 23, Engineering 25, Medicine 50, Navigation
57 and Physics 61. [Knowledge validation](review/knowledge-validation.json) checks
the enum values, category rows, labels/icon identity, six distinct images, all
20 category/era files, clear label bounds, empty/invalid fixture edges and D/R
parity. Other advances still require explicit per-advance artwork metadata for
the enhanced backend; native category coverage is independent of that extension.

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
are extracted from `gamedata.cpp`. Economy summary rows and resource-terrain dispatch now execute unchanged. Full
city yield recalculation and the units-present detail state remain supplied. The native list and stockpile functions do execute, including compressed
icon spacing at population 28. Optional extras and interactive hit testing are
outside this fixture. A full game build remains the future integration test.

**Replacement native resolution** uses new art at native drawing resolution.
The replacement-native and HD-only window stages consume the same native
trace and identical logical artwork rectangles; only physical density changes.
The gallery notes these limits so they cannot be mistaken for gameplay captures.

## Map object size contract

For logical tile widths of 48 pixels and above, the proposal replays a separate
native object trace from `draw_tile_city` and `draw_tile_units`. It uses the same
64×48 logical unit/city frames, selected sprite IDs, zoom arithmetic, anchors,
flags and population labels as HD-only. Shields and health bars retain native
state, with the proposal applying the separate badge sizing and layering policy
documented below. Units and cities retain their full source image rectangles. Ground/network/feature passes
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
improve composition. All stages explicitly use the same all-map view;
fog is disabled for art inspection rather than represented as player knowledge.

Four additional unchanged bodies run in the `save_native` namespace:
`tile_resource`, `tile_has_hut`, `tile_grassland_has_shield` and
`unit_stack_pick_display_unit`. Imported resource/hut/shield flags are checked
against those source formulas over all 9,000 cells in Debug and Release. The
adapter supplies validated stack links, tile owners, civ advances, city
improvements and unit stats; source selection chooses city size/style/walls,
top unit, health and stack badges. Proposal ground lookups wrap horizontally. The grassland production overlay
uses a smaller olive/bronze shield derived from the same silhouette, independently
of the blue city economy symbol; detailed proposed maps retain those markers
and source-selected huts.
The coin is a raster-art replacement within the existing native 14-pixel boxes;
HD-only changes image density, while tax and improvement-list semantics stay the same.

This remains a render-state replay. Saved map labels and native font metrics
now execute; replacement palette choices, supplied order state and interactive
camera/gameplay execution remain backend/fixture limits. The data is diverse gameplay state, not a claim that the
standalone program loads or runs the full game.

## Original-art replay

`original-assets.py` and `original.cjs` provide the fourth comparison for all
22 scenes. Composed scene PNGs, four 4K exports and their gallery index/hashes
are tracked in `review/original-scenes/` under the user's scene-only review
exception. Source sheets, extracted sprites, local traces and contact sheets
remain ignored in `review/original-local/`. Neither the game source nor the
replacement library depends on these files. The gallery loads the committed
render index, so viewing the scenes does not require an installed game; it never
substitutes new art under an original-art label.

The geometry comes from this checkout's `gfx_load_terrain_sprites`,
`gfx_load_city_sprites`, `gfx_load_unit_sprites` and icon/people loaders in
`src/auto/graphics.cpp`. GIF indices add ten with byte wrapping, so raw 253 and
255 become the runtime transparency keys 7 and 9. Dither construction replays
the alternate-key mask operation and quarter order. City sprite indexing is
style × 8 + size × 2 + walls. The original optional native mode reads the unit
shield and city flag/size-box registration scans from `unit.cpp:906` and
`city.cpp:4009,4034`; flags are 14×22 and disorder is 30×30. It supplies the
original sheet-derived civ primary/mid/secondary colors. Replacement sprites
retain their own art registration metadata.

City panorama and throne crop rectangles are captured at the native
`Sprite::grab_from_surface` boundary, including selected resource IDs. Original
city background selection uses native terrain kind and era, including the
superhighways override; the fixture's industrial house/lot bank comes from CV
310. Thrones begin with PV 100. Diplomacy replays native background, portrait,
military and science crops, with the shared palette ranges from
`DiploLeaderWindow::init_main_art` and `init_portrait`, including the leader civ
color at runtime index 145. This is the static audience fixture; no AVI is read.
Spacecraft uses SS 499 (`spaceship.cpp:314`), and native ordered split crops are
clipped to the 457×304 assembly surface before copying to (175,99). City windows
use the 636×421 CITY.GIF crop from `city.cpp:11940–11942`, exact citizens and
14/10-pixel economy icons. Resource bars and terrain dispatch now execute source
bodies; original-art labels use the reference glyph bank. Controls and present-unit
state retain the finite presentation boundary described in FIDELITY-AUDIT.md.
This does not claim pixel-exact full-game window capture.

Local verification covers all 22 output dimensions, four 3840×2160 exports,
all extracted PNG hashes, unchanged original input hashes and 26 original-mode
map/city/throne Debug/Release traces. Every image operation resolves to a local
original binding and missing sprites fail the build. The original renderer
path is checked by `original.cjs`; `verify.cjs` separately checks the replacement
path and unchanged native source bodies.

## Map readability adapter changes

`map-finishing.cjs` builds coast quarters from exactly three available
neighbors. The 32×16 logical boxes and source-selected masks remain unchanged;
there is no water overhang. The radial land profile now spans 0.635–0.765 tile
units, rather than reserving 0.755–0.875 in every direction. A separate smooth
eight-power footprint, radius `0.57 / (|nx|^8 + |ny|^8)^(1/8)`, protects the
occupied tile and its diagonal tips. A 0.025 smooth maximum joins that footprint
to the fractal headlands. This removes excess land along tile sides without
reintroducing sharp rectangular shorelines. Direct alpha checks cover the visible
fringe pixels (alpha ≥ 8) outside the tile diamond in the six unique
native irrigation/farmland/forest sprites, using a lone land tile as the
conservative neighbor case. The four denser forest masters keep the same
source-selected frames. Pine
variant 3 is packed one logical pixel higher within its 64×32 frame to retain
coastal clearance; no source draw offset changes. This is native artwork
coverage, not a claim that every enhanced tree canopy has land beneath its projected silhouette.

The previous 15% water-coordinate expansion is removed. Lake size follows the
reduced land allocation itself. A compact power union (0.12 support, exponent
1.25) rounds lobe intersections. The outline report records water area as well
as shape. Independent quarter checks and protected tile tips still pass.
Two perpendicular land neighbors bound the inward water corner with an ellipse
whose axes follow their existing shore crossings. The ellipse is perturbed by
five scales of bounded angular relief (frequencies 2, 4, 8, 16 and 32), sampled on
a fixed contour ring so each ray retains one bank crossing. Broader asymmetry
contains smaller bank notches; projected-pixel filtering suppresses fine scales
at distant zooms. Native sampling repeats exactly, while enhanced phases vary
over the wrapped world. Final lake-outline checks reject both pointed corners
and uniformly elliptical ponds. A 0.06-unit easing band at
quarter axes makes the added contour contribution vanish at shared boundaries;
a local 0.02 smooth minimum joins it to the eroded land lobes. This changes the
actual dry-land boundary around inlets and single-cell lakes. The native bank
and enhanced sampler share this rule, using only each quarter's known neighbors.
Exhaustive masks and the saved lakes retain water and land connectivity. The
ordinary water-side shading band extends 0.115 tile units;
the land-side band remains 0.055. A stronger depth gradient, patchy shoals and
more visible sand/rock exposure separate ocean and land without changing tile
classification, source commands or foreground placement.
The retained macro contour is augmented by an independent six-octave fractional
Brownian detail layer after its tanh shaping, so macro saturation does not
flatten the fine contours. Periodic low-frequency domain warping breaks up
axis-aligned noise. Detail amplitudes decay with doubled frequency; bounded
reflection keeps the authored land/water radius limits without clipping flat
segments. Compact tapering at concave lobe intersections prevents small isolated
water pockets. At 32 projected pixels and below the added layer is exactly zero;
the validation report records displacement and additional detail at higher scales.
Fine octaves use a conservative projected-pixel cutoff for isometric
foreshortening. Connectivity checks also cover all 22 isolated saved-world lakes
at 256 physical pixels per tile, using their actual world noise phases. Patchy deposits and shallows replace the continuous shoreline rim.
Relief is sampled along a fixed contour around each land center, retaining one crossing along each radial line.
Native variation repeats at sprite seams; enhanced variation uses world
coordinates and the map wrap period. The enhanced sampler fades octaves below
two projected pixels while native/HD filter the retained PNGs on resize.
The finite checks retain water-cell centers and require each water component
to reach its center or an adjacent ocean tile, including coves crossing a seam.
Quarter textures use a common periodic tile phase. `render.cjs` restores opaque
pixel-center ground coverage after color resampling for generated terrain/coast
bindings only; original art and foreground alpha are untouched. Ocean-neighbor
dither slot 12 now feathers the land into the existing grassy apron. Native mouth bindings retain their river-edge pixels and
fade their banks seaward beyond the varied land apron; enhanced river sampling
includes adjoining ocean mouths.
The terrain production marker remains smaller and muted olive/bronze, with the
city economy shield unchanged. See the [full-map survey](review/coast-audit.html)
and [finite checks](review/coast-audit-validation.json).

The terrain-only production marker has an approximately 11-pixel native visible
height (previously 14), olive/bronze colors and a quieter outline. The native
64×32 frame, centered anchor, resource presence and selection are unchanged.
City stockpiles and worked-tile yield icons retain their blue production artwork.
See [four-stage details](review/map-finishing.png) and
[coverage/visibility checks](review/map-finishing-validation.json).


The source renderer bodies remain unchanged. Coast quarters still use the
NE-first native neighbor masks. The authored bank distinguishes the outer
cardinal bit from the two adjacent diagonal bits; a lone cardinal touch does
not paint a disconnected land wedge inside ocean. Native dither slot 12 is an
authored grass-textured coastal feather, replacing the former transparent slot.
It shares the coast quarter texture phase and protects the central material and
cacti. Its full boundary coverage removes the sandy diamond at Newcastle;
adjoining coastal quarters meet without an artificial tip fade. Graded patches
and fine clustered flecks replace a nearly constant-width fade; four warped
noise scales vary coverage along an equal-depth contour. Validation checks
that this contour contains both exposed sand and grassy coverage, plus the
continuous limits across the shared quarter axes. Slot 11
uses dark fog colors. These choices affect art, not tile classification.

Resource PNGs now use centered trim bounds in a 512x256 frame. Native review
commands still consume 64x32 logical resource frames. The proposed pass uses
the same complete frame at the projected tile center; it previously applied a
second half-size fit and vertical offset. Ocean resources occupy up to 72% of
frame height, land resources 58%, with transparent padding.

The replacement palette adapter distinguishes primary/mid faction colors and
health colors. Shield artwork uses one flat faction-color face and a dark outline,
without the former inset strip or bevel. Unit order
text is centered at the native shield text anchor in the standalone backend;
this corrects the prior left/top interpretation, including original-art replays.
Original-art fonts use the reference bank; native and HD-only use identical logical
commands. Enhanced text remains on its independent presentation path.
`readableBadges` modifies only the proposal's badge group: 1.35x scale, separated
rear plate, a plus sign for a source-indicated stack, and foreground placement.
Unit/city selection and image frames are unchanged and checked directly.
Replacement banner registration is recorded in [unit-anchors.json](map/unit-anchors.json).
The twelve naval types use `(2,0)` in the transparent upper-left of their 64×48
frame; other units retain `(48,4)`. This clears the larger replacement ships
while preserving the source's shield-before-unit order in native and HD-only
views. `extract-engine.py` supplies this metadata to the standalone adapter;
original-art mode still loads original-sheet anchors. Enhanced badges retain
their separate enlargement, stack separation and foreground pass.
See [unit banner checks](review/unit-banner-validation.json) and the
[updated map crops](review/unit-banners.png).

The synthetic district adds two ocean resources and explicit linked unit records.
Its metadata supplies real `prev_in_stack`/`next_in_stack` values, allowing the
unchanged source `gfx_draw_unit` stack branch to execute in all four stages.
The imported 1788 save is unchanged. No new reconstruction/Ghidra facts or game
source changes are claimed by this artwork work.

## Rail continuity

The replacement nine-slot rail bank keeps the native draw trace, slot dimensions
and endpoints. Directional arms now end flush at the tile center: the previous
backward spur and rounded end cap obscured the other arm's steel, most visibly
with the stronger ballast contrast. The isolated slot retains its end treatment.
Native bends retain the source's independent-arm limitations.

The proposal draws rail beds for all visible tiles, then sleepers, then metal.
This prevents a later tile's ballast from erasing an earlier track at a shared
edge or geometric crossing. Junction masks use complete through routes instead
of steel strips terminating at the center. This is a visual connection policy;
it changes no movement state and does not claim physical turnout simulation.

`verify-rail-joins.cjs` checks exported native PNG joins, both proposed draw
orders at all eight edges, and all 256 masks (including isolated artwork in the
transport plate). Its pixel probe failed on the former capped arm artwork.
No native game source bodies or original-art bindings change.

## River artwork and sampler

`riverCurve` supplies irregular cubic meanders for the four NE/SE/SW/NW river ports.
Channel widths vary more strongly; each bank has independent erosion offsets.
`riverbanks.cjs` supplies six domain-warped fractional Brownian noise octaves
after the macro curve is formed. Native SVG outlines use 257 samples per route
and smooth relief falloff confined to the end 16% of the path. Bank displacement
and its derivative vanish at the fixed-width ports; every bed layer shares the
same displacement so its outline cannot cross the water outline. Finite summed
amplitudes keep the channel open without flattening fine detail with a clamp.
The thin pale rim is replaced by a subdued sediment/vegetation wash. Painted
water and bed extend 1.5 canonical pixels past the fixed ports to close
antialiased butt seams; curve endpoints and tangents remain unchanged.
Every native mask retains its logical 64x32 sprite frame and uses the matching
crop of the canonical 576x320 padded SVG/PNG. Family/mask lookup replaces a stale
directory-name match that had selected the generator fallback instead of that
canonical artwork. Source sprite selection and river-mouth slot aliases remain
unchanged; the new textures are used by native and HD-only review stages.

The proposed sampler uses the same connection masks and curve family with bend
phase and channel width sampled in fixed world coordinates. Position-dependent
width modulation makes the banks asymmetric. Relief is sampled on a fixed radial
bank profile so each cross-section has one water-to-land crossing; this prevents
detached high-zoom water pockets. The added fractal layer follows
physical display resolution, suppresses subpixel octaves, and vanishes at 32px
and below. Width/noise periods match the world wrap, and boundary segment copies
provide both connected curves across the cylindrical seam. Fine spatial buckets cover the
maximum wider bank envelope and bound the cost of the denser curve segments. River banks suppress ocean foam
inland and blend back to coastal water at mouths. This is visual geometry and
material variation, not a simulation of flow direction, catchments or erosion.
`verify-rivers.cjs` records native crop equality, edge continuity in both draw
orders, width variation and hidden-state isolation in `review/river-validation.json`.
The riverbank verifier adds six detail scales, 12,288 periodic checks, 16
enhanced connection masks at both 256px and 512px (1,310,720 classified pixels),
82 directed saved river ports, 11 saved mouth ports,
18,600 boundary samples and 6,510 wrapped-river samples. Results are in
[riverbank-validation.json](review/riverbank-validation.json); the four-stage visual review is
[river-fractal.png](review/river-fractal.png).
The native source renderer and original-art replay remain unchanged.

## Citizen sprite selection

`gfx_load_people_sheet` (`src/auto/graphics.cpp:999-1044`) loads four 11-sprite
rows at 27x30 pixels. `CityWindow::draw_citizen_row`
(`src/auto/city.cpp:12165-12284`) indexes `era * 11`, with slots 0/1 happy,
2/3 content, 4/5 unhappy, 6/7 angry and 8/9/10 specialist types 1/2/3.
The ordinary `citizen_num & 1` alternation continues across mood groups. There
is no equivalent gender toggle for specialists. The separate small happiness
report uses one 11-sprite row; that report is outside the current window fixture.

`civ_city_style_era` (`src/auto/civ.cpp:2907-2930`) returns 3 for Electronics
and Automobile, otherwise 2 for Industrialization, otherwise 1 for Invention
and Philosophy, otherwise 0. The standalone harness accepts the resulting era
as explicit fixture state. Its original fixed era 2 default remains available.
It does not execute technology research or infer era from the displayed year.

`citizens.cjs` now maps all 44 native IDs to the retained paired/specialist
portraits. The previous replacement backend discarded era and gender. The
industrial normal fixture and modern crowded fixture preserve the same source
selection in all four stages, including the original-art scene replay.
Enhanced-only mood/profession badges draw after the full row, inside the same
portrait frames, preventing later overlapping citizens from hiding earlier cues.
[Citizen validation](review/citizen-validation.json) checks four source D/R
traces, all 44 slots, continuous gender order across odd mood boundaries, all
three specialists and six window variants.

## Enhanced city scale and visibility

`city-panorama.cjs` consumes the unchanged `CityViewWindow` trace. It retains every
non-lot command and its source index; empty-lot tint sprites are omitted as in the
earlier proposal. Relative widths for all improvements and wonders come from
`city/panorama/layout.json`, independent of the native 123x82 and 158x114 slots.
Trimmed canonical sprites preserve their aspect ratio and use a shared perspective
scale. Large landmarks reserve space first. A coarse alpha-occupancy map guides
placement around actual silhouettes rather than transparent rectangular corners.

The native source uses slot-index draw order (`city.cpp:4647`). The proposal
instead sorts normal objects by their ground-contact Y position, with source index
as a stable tie-breaker after X. Rear curtain walls precede all objects; foreground
curtains and a nearly frontal painted gate draw last. Curtain endpoints use
explicit attachment points inside the gate towers, at equal ground height in the
same trimmed/rounded sprite frame. One source city-walls improvement controls
the complete assembly. Original/native/HD-only stages keep the original
slot and order contract; no game source changes are included.

`verify-city-panorama.cjs` checks all size definitions, exact source selection,
in-frame rectangles, painter order, substantial landmark/house ratios and actual
remaining alpha-visible area after occlusion. It checks opaque gate/wall contact
strips on both towers in all three sites. It independently re-renders the six
native/HD panoramas and compares their hashes with the retained images.

## City population badge placement

Replacement/native and HD-only stages use 48 explicit entries in
[`map/city-anchors.json`](map/city-anchors.json). Anchors are selected from each
replacement silhouette, then visually reviewed; the large walled industrial
variant has an upper-west adjustment for the saved-game active-unit overlap.
The 26×16 envelope is the three-digit box at the 64×48 reference frame, not a
promise that original zoom rules keep every label inside a miniature city.
Original-art replays still load their own sheet markers. Source drawing order,
population selection, digit fitting and sprite frames are retained in native/HD.

Enhanced views separate the source city-size frame/fill/digits from the object
pass. Unit tags and stack marks reserve space first, then population badges,
then city names. A deterministic bounded search chooses the nearest free
position; labels draw after scenery and objects. Partially visible labels move
inside the viewport, while city badges whose tile center is outside the view and
wholly offscreen names stay out of view. At overview widths below 48 logical
pixels, the existing city-marker/name representation still omits numeric badges.
No sprite is shrunk or moved. This is a static proposal: temporal label hysteresis
and arbitrary dense interactive states are not qualified. Exhausting the bounded
search stops the review rather than silently hiding a label.

[Anchor contact sheet](review/city-size-anchors.png),
[per-scene placement plans](review/city-label-layouts.json) and
[validation](review/city-label-validation.json) accompany the existing maps.
`node tools/atlas-review/city-anchors.cjs` refreshes the contact sheet;
`--author` explicitly reselects anchors after artwork changes. Rebuild both
standalone configurations, then run `refresh-city-labels.cjs`, `verify-city-labels.cjs`,
`verify-typography.cjs`, `verify.cjs`, `build-gallery.cjs` and `fidelity.cjs`.
Only standalone tools, metadata and review outputs change; game source is untouched.

## Fields beneath cities

`MapView::draw_tile_land` (`src/auto/mapview.cpp:1653–1677`) draws irrigation or
farmland beneath some cities even when the city tile has neither improvement bit.
For the city-without-airbase branch, it examines the SE/SW neighbors (direction
indices 2 and 4), retaining the native precedence between irrigation and farmland.
Both Carlisle and Gloucester have `f=k=3` in the retained save. Carlisle has an
irrigated SW neighbor and receives a field command; Gloucester does not. No save
bits or fixture data were changed to create the distinction.

The former enhanced renderer tested only each tile's own improvement bits and
omitted this city-neighbor behavior. `render.cjs::fieldCommands` now takes field
selection and rectangles directly from the unchanged source map trace. It keeps
the enhanced 64-logical-pixel field-detail cutoff, and composites fields before
roads, rails and objects. Native/HD selection and ordering remain unchanged.

The two replacement field sprites are now flat, broad 2:1 terrain diamonds with
crop rows and water channels extending into their outer wings. Their derived
bindings fill the 64×32 terrain frame instead of using the tall-object fitting
helper. City sprites, city frame sizes, flags and population anchors are unchanged.

`fields-review.cjs` refreshes the five affected maps and the
[four-stage Carlisle/Gloucester comparison](review/irrigation-cities.png).
`verify-fields.cjs` checks Debug/Release city-neighbor cases, all map field
selections and rectangles, 96 city/field silhouette combinations, and the actual
final pixels at close/regional zoom in all three replacement stages. Its
counterfactual removes only Carlisle's field command, so neighboring irrigation
cannot falsely satisfy the visibility check. The two city-window resource-map
fixtures contain no fields and need no image refresh. Results and limits are in
[field-validation.json](review/field-validation.json); unchanged source, city
sprites, original scenes and fixture/trace files are recorded in
[field-preservation.json](review/field-preservation.json).

## Native window background plates

The city loader (`city.cpp:11921–11948`) loads a 636×421 background and scales it
as one sprite. `CityWindow::layout_rects` (`city.cpp:15133–15148`) supplies the
panel rectangles. The foreground renderer assumes that static subdivisions are
already in that background. The new city plate uses these rectangles and the
source resource-bar spans to separate the citizen strip, map, food/trade/shield
sections, stores, unit areas, improvement list and button area.

Diplomacy loads government resource `200 + government` (`diplomacy.cpp:4629–4670`).
Its military rows occupy `(45,130+31*i,108,30)` and knowledge rows occupy
`(485,130+31*i,108,30)`; labels use the source 58×20 rectangle beginning near
`(531,137)`. Seven government plates place quiet pale plaques behind those fixed
rows and frame the unchanged `(208,57,225,275)` portrait. They retain category
icons, repeated power emblems, truncation and era-specific text colors. There are
no baked labels, invented regiment names or new interactive controls.

The spacecraft plate quiets the source title, statistics and success-message
areas. It does not change the split-crop ship assembly. Background art cannot
resolve overlaps between foreground parts and text; those remain an independent
layout concern. The city and diplomacy fixes do not require such a layout change.

`native-backgrounds.cjs` builds nine new SVG/PNG plates from authored vector
geometry and the retained Atlas paintings. SVGs retain the logical size and
PNGs use 4× raster density. `native-windows.cjs` substitutes only the first
full-window image in replacement/native and HD-only modes. Original mode retains
its local bindings; enhanced windows retain the existing painted backgrounds
and their own panel composition. No game source, source trace, palette mapping,
text metric, icon, button or hit-test geometry changes.

`refresh-native-backgrounds.cjs` refreshes the ten affected renders and their
image draw plans. `verify-native-backgrounds.cjs` compares foreground-only PNG
hashes and normalized draw plans against pre-change commit `2cd48fe`, covering
both densities, both city populations, diplomacy and both spacecraft states.
It also checks source panel bounds, nine opaque plates, absence of baked text,
and background contrast beneath city labels and all three native diplomacy
foreground colors across seven governments. See the
[baseline](review/native-background-baseline.json),
[validation](review/native-background-validation.json) and
[preservation record](review/native-background-preservation.json).
These are bounded artwork/source checks, not whole-frame live-game parity.

### Forest ground edges and terrain vegetation

The native forest-floor update changes the forest ground PNGs and derived
`terrain/3` and `dither/3/*` bindings. The renderer still executes
`MapView::draw_tile_land` in this checkout (`src/auto/mapview.cpp:1549`):
base terrain, neighbor dither quarters, then the source-selected forest sprite.
Desert cacti are baked into the base sprite, as in the original art; the native
command trace gains no extra draw calls. All changed cactus pixels remain inside
the zero-dither material core. The sixteen forest commands retain their original
mask indices and boxes. Replacement slots 3/8/10 use the pointed evergreen style
observed in those original-art slots; other masks use broadleaf trees. Source
selection is unchanged (graphics.cpp loads sixteen shapes, not a random species).

The enhanced forest selector converts staggered x/y to tile-lattice coordinates
before choosing one of four images. The previous odd-coefficient x/y sum modulo
four reached only variants 0 and 2. Its cacti are a separate low-detail overlay
at logical widths of at least 48px, omitted on cultivated or river desert and
drawn below fields/networks. These additions are confined to standalone artwork
and proposal rendering. See [vegetation checks](review/vegetation-validation.json).
The new artwork keeps the full opaque land diamond, blends its perimeter into
grass and reduces the contrast of leaf litter beneath the tree cluster.
Native neighbor selection, zoom gates and sprite boxes are unchanged. The shared
land-transition authoring step uses four scales of periodic, domain-warped
coverage in all forty land-neighbor PNGs. Coverage ranges from light to nearly
opaque with a light continuous wash, allowing patches to cross the old half-opacity
line. Opposite quarter masks are complementary at the common edge outside a
narrow tip fade; the source's separate quarter rectangles therefore retain
compatible coverage. The unchanged inner 56% of the tile's diamond radius has
zero neighbor coverage, preserving terrain identity and baked desert vegetation.
No source commands, terrain/feature slots, base PNGs or draw ordering change.
The existing standalone baseline compositor is also unchanged.
The native mask test checks 1,026 complementary edge samples, 204,480 protected
core pixels, quarter-side fade and all eight unchanged ocean/fog slots. The four coastal slots are checked
separately for protected cores, quarter joins and apron color continuity in
[coastal feather validation](review/coastal-blend-validation.json).
The [four terrain pairs](review/native-land-edges.png) execute unchanged source
traces in Debug and Release. They are supplied rendering fixtures, not gameplay.
The enhanced pass uses the mixed forest material within its existing continuous
ground sampler. Its terrain weights now concentrate blending around irregular
boundaries and preserve material cores. A continuous bilinear fallback supplies
land color wherever the fuller coast extends beyond those weights; coast geometry
is unchanged. The [land review](review/land-borders.html) covers all ten land
types in the real save, at two zoom levels and all four stages. No game source
or production drawing behavior is modified.
