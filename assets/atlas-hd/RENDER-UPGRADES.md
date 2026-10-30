# Scoped renderer upgrades

Keep the staggered isometric grid, painted sprites, fixed camera angle, familiar
unit silhouettes and readable city icons. A 2D sprite renderer can provide the
desired improvements; a 3D scene, models and perspective camera are unnecessary.
All proposals here are implemented only as review tooling or documented future
work. The game source is unchanged.

## 1. HD image support — the first, independent change

**Review: every scene, Legacy → HD only.** The exact source command stream is
replayed with the same geometry, order, visibility and zoom gates. Higher native
image resolution and a 2× display-density backing surface improve fine detail,
but repeated ground, coast-quarter shapes and separately overlaid road arms
remain visible. This is the correct baseline for judging later changes.

Add an RGBA image provider beneath `Sprite::draw` and the image-loading paths in
`src/auto/graphics.cpp`. Give each sprite a native pixel rectangle, a logical
frame, an explicit anchor, trim bounds, color-mask channels and its density.
Keep map coordinates, native logical boxes, resource IDs and saved-game formats
unchanged. Retain new alpha; do not quantize it into the old palette or infer
transparent pixels from a background color. Replace palette recoloring of flags
and shields with a dedicated faction mask. Crop and anchor metadata must be
selected deliberately; fitting every image to an arbitrary old rectangle is not
an integration policy.

Separate **display density** from **map zoom**. A 64×32 logical tile can use a
512×256 texture without becoming eight times larger in the game world. Account
for DPI in the output surface and input conversion once. Keep native pixels and
logical rectangles separate through clipping, dirty rectangles and hit testing.
The original scale-table guard in `Sprite::blit_to_surface` is a reason for a new
backend; merely feeding larger bitmaps into the old row blitter is insufficient.

A Windows implementation can use WIC for PNG decoding and an explicit pixel
format conversion. WIC documents a native PNG codec. If adopting Direct2D for
2D bitmap compositing, choose a documented pixel-format/alpha-mode pair and
convert consistently; premultiplied BGRA is a supported combination.
[WIC PNG codec](https://learn.microsoft.com/en-us/windows/win32/wic/png-format-overview),
[Direct2D formats and alpha modes](https://learn.microsoft.com/en-us/windows/win32/direct2d/supported-pixel-formats-and-alpha-modes).
This backend choice is a recommendation, not a dependency added by this branch.

**Acceptance:** same selected sprite IDs, logical rectangles and order at every
native zoom; crisp edges at 100%, 150%, 200% and 300% display density; faction
colors and translucent effects; correct picking and clipped edges; no reads of
original image resources for the integrated resource families. Verify actual
runtime Debug/Release behavior on x86, rather than substituting these fixtures
for integration evidence.

## 2. Shared transport geometry and overlay priorities

**Review: transport matrix, district and close scenes, HD only → HD + cohesion.**
The isolated segment, endpoint, bend, crossing and junction use one road width,
material, light direction and endpoint contract. Rail has one gauge and ballast
width. Paired boundary pieces share tangent and endpoint positions. Padding is
retained beyond diamond vertices; only true dead ends receive round caps.

Replace composition of nine independent arm images in
`MapView::draw_tile_roads` with a connection description built from the **same
viewer-known state and source predicates**. Keep all eight neighbors and city
endpoint behavior. Do not infer a connection from the presence of a city icon
alone when the source would not reveal it. Convert NE-first game bits to N-first
art bits explicitly. The existing 256-mask road and rail SVG banks
are design references; loading all masks eagerly is unnecessary.

Build transport below tall sprites after all visible ground has been drawn.
Separate ballast/roadbed, sleepers, rails and endpoint/junction decoration so a
later tile's roadbed cannot cover another tile's rail. Use one junction when
multiple arms meet. Keep road-to-rail transitions intentional. The prototype
uses complete curves and padding; a production pass should additionally phase
sleepers along shared edges and define explicit turnout/bridge artwork.

Irrigation and farmland need the same ground plane and a reserved transport
corridor. Mines should occupy a consistent side of the tile instead of hiding
the entire route. The prototype draws fields first and moves tall features away
from the centerline. Additional bridge decks, approaches and road/river crossing
rules are a remaining extension: the current prototype demonstrates river
continuity, but does not claim complete bridge or turnout design.

**Acceptance:** all 256 masks, all eight paired boundary directions, mixed rail
and road, isolated-to-connected transitions, city endpoints, bridge approaches,
hidden/remembered neighbors, draw-order reversal and fractional camera movement.
Keep movement/connectivity rules unchanged; these are visual connections only.

## 3. Continuous ground, coastlines and repetition

**Review: coast and repetition scenes, HD only → HD + cohesion.** HD alone makes
the repeated tile texture and quarter seams sharper. The additional prototype
samples a shared world-coordinate material field and blends deterministic
variations. Ocean, shore and river use one sampler, so the river mouth meets the
same water rather than laying a rectangular river sprite over it.

Replace `draw_tile_land` dither composition and `draw_tile_ocean` quarter assembly
incrementally. First cache a visible ground layer with stable world UVs while
retaining source selection. Then introduce a shared coast field generated from
neighbor terrain. The prototype interpolates four surrounding tile centers;
the old renderer uses four independent three-bit quarter masks. These are
different topology representations. Preserve every tile's gameplay land/water
classification and show the exact tile boundary on selection. Art may soften a
corner, but must not suggest a traversable land bridge across water.

Prefer a deterministic edge/vertex representation for production: adjacent
chunks share the same coast crossing and tangent. Resolve diagonal saddle cases
consistently, and provide tests for one-tile islands, bays, narrow channels,
concave corners and map wrapping. Keep narrow channels readable at overview LOD.
Coasts and rivers should share water color, shallow-water range, shore width and
mouth opening. Do not use an opaque diamond cutout as a tall terrain feature.

The new 4×4 material master contains four variants each of grassland, plains,
desert and calm water. The prototype blends choices on a stable three-tile world
lattice; choices do not change while panning. Mip levels reduce texture contrast
at overview scales. The retained four-phase ground and coast banks can be used
by a bounded atlas implementation; their phase is world-derived, never chosen
independently for each visible tile. Shared samples remove seams more reliably
than trying to disguise gaps with more painted detail.

**Acceptance:** identical edge samples across independently rendered chunks,
no alpha cracks at fractional scale, stable texture choices during pan/zoom,
coast saddle and wrap cases, connected estuaries, no hidden terrain influencing
visible material choices, and no navigational ambiguity at narrow channels.

## 4. Zoom and level of detail

**Review: close, region and full-world presets.** The current two baseline stages
retain the native -7…8 zoom rules and abrupt feature cutoffs. The additional
prototype keeps transport readable with simple lines and substitutes small city
and unit markers at overview scales. Its world image uses quiet material colors
instead of dense miniature mountain/forest sprites.

Separate the camera's continuous scale from the representation chosen for a
tile. Preserve the original 2:1 projection. Anchor zoom under the pointer and
perform selection using inverse world coordinates rather than a scaled bitmap
pick mask. Add fixed zoom stops for familiarity, plus continuous interpolation
between them. Density changes must not move the world camera.

Suggested starting thresholds in **logical tile width**, to tune with playtests:

| Tile width | Representation |
| --- | --- |
| ≥ 128 logical px | Full terrain detail, readable individual sprites, field details, rail sleepers |
| 64–127 px | Regular sprites, subdued field texture, limited labels |
| 32–63 px | Sparse terrain features, simple transport lines, city and unit markers |
| < 32 px | Quiet terrain colors, major routes, cities and grouped unit markers; selected objects remain explicit |

The prototype uses 64 px for field detail and 48 px for tall features and marker
substitution. It demonstrates still-frame endpoints, **not** animated transition
hysteresis, label collision or unit clustering. Production should add a small
hysteresis band (for example ±10%) and crossfade visual layers without changing
selection. Keep label priorities stable: selection, active unit, cities, then
optional detail. Group markers in stable world-space cells and show counts; do
not reveal hidden units through grouping. Validate ownership, city garrisons and
stack interaction at each level.

For a 3840-pixel-wide close view spanning ten tiles, the physical tile width is
384 px. The 512×256 ground/network authoring scale supports that use; individual
unit crops have their own recorded native sizes and may still need more detail
at extreme zoom. A complete 128×128 coordinate world has 64 tile widths across,
so it needs about 60 physical pixels per tile at 4K. Scale decisions must account
for display density rather than treating those physical pixels as logical ones.

**Acceptance:** approximately ten tile spans through the full world, stable
selection under the pointer, no zoom popping, readable selected units, persistent
fog, correct wrap, labels without severe overlap and stable sprite ordering.

## 5. City and throne metadata

**Review: the three city sites and early/mixed/complete throne stages.** HD-only
preserves every source slot and layer. The additional city view keeps the source
selection and order, but remaps base anchors into the new background's land-safe
area and adjusts depth scale. The throne prototype assigns explicit back-to-front
layers and floor anchors to the same selected upgrade levels. Neither requires
3D geometry.

Move art-specific crop, anchor and occupancy information out of implicit resource
sheet rectangles into a versioned metadata file. Retain the game-state selection
in `CityViewWindow::layout_buildings` and `ThroneRoomWindow::render`. Permit a slot
to refer to a composed layer (for example paired columns) without changing its
gameplay meaning. Define occlusion intentionally so a last-drawn room decoration
does not obscure the throne. Include empty, partial, mixed and complete states.
The review tool's compatibility bank demonstrates that new art can already be
composed inside native boxes; the extra metadata gives it a more natural scale.

## Delivery order, memory and profiling

Implement scope 1 first and compare against the saved source traces. Ship the
HD-only path behind a renderer selection flag before changing map composition.
Then take transport and ground as separate changes, followed by continuous zoom
and scene metadata. Keep source IDs and gameplay state independent from caches.

Use bounded caches and dirty regions. As arithmetic estimates, one RGBA
512×256 tile is 0.5 MiB, and one 576×320 padded network image is about 0.703 MiB.
Eagerly holding 256 masks for each of road and rail would consume about 360 MiB
before mipmaps. Prefer on-demand masks, shared geometry or an LRU cache. Sixty-four
512×512 raster-cache pages consume 64 MiB, or roughly 85 MiB with a complete mip
chain. These are planning estimates, not measurements of this game.

Invalidate a tile and its relevant neighbors when terrain, visible improvements,
ownership or exploration changes. Include palette/theme, density and LOD in
cache keys. Add gutters for filtered atlas sampling; filter premultiplied alpha
consistently and check dark/light backgrounds. Avoid baking the whole 4K world
into a giant texture at the closest zoom.

Measure decode time, peak memory, cached and uncached pan/zoom frame time, changed
tile redraw cost and number of submitted sprites on a declared x86 target.
`review/scenes.json` records offline CPU image-build times only. They include
authoring work and are **not** engine FPS or evidence of GPU performance.
