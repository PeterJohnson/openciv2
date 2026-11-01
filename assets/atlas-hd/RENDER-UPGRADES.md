# Scoped renderer upgrades

Keep the staggered isometric grid, painted sprites, fixed camera angle, familiar
unit silhouettes and readable city icons. A 2D sprite renderer can provide the
desired improvements; a 3D scene, models and perspective camera are unnecessary.
All proposals here are implemented only as review tooling or documented future
work. The game source is unchanged.

## 1. HD image support — the first, independent change

**Review: every scene, Replacement native → HD only.** The exact source command stream is
replayed with the same geometry, order, visibility and zoom gates. Higher native
image resolution and a 2× display-density backing surface improve fine detail,
but repeated ground, coast-quarter shapes and separately overlaid road arms
remain visible. This is the correct baseline for judging later changes.

Treat background layout as an asset contract at this stage. The original city
and diplomacy backdrops contain functional subdivisions; replacing them with a
generic illustration loses structure even when every foreground command is
faithful. The native previews now include new background plates aligned to the
source rectangles, without changing dynamic content or adding a layout engine.
Use dark city surfaces behind the existing light labels and pale diplomacy
plaques behind its existing dark text. The spacecraft background similarly
quiets the title/statistics areas. [Inspect the plates](review/native-backgrounds.png).
These improvements are present in both replacement-native and HD-only views.

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
uses complete curves and padding, draws all rail beds before sleepers and steel,
and pairs junction arms into continuous through routes. Native directional PNGs
use flush center cuts so opposing arms cannot cap one another. A production pass
should additionally phase sleepers along shared edges and define explicit
turnout/bridge artwork.

Irrigation and farmland need the same ground plane and a reserved transport
corridor. Mines should occupy a consistent side of the tile instead of hiding
the entire route. The prototype uses flat full-tile field sprites, draws fields
first and moves tall features away from the centerline. Preserve the native
city-neighbor rule when separating ground and object passes: the enhanced
renderer now reuses the field commands selected by `draw_tile_land`, including
the field beneath Carlisle, while Gloucester remains bare. Merely checking the
city tile's irrigation bits loses this effect. Keep city sizes unchanged and
reserve visible crop/channel detail at the field perimeter. See the
[four-stage comparison](review/irrigation-cities.png) and
[occlusion checks](review/field-validation.json). Additional bridge decks, approaches and road/river crossing
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
Before adding renderer behavior, improve the native neighbor-quarter artwork.
The current art-only pass uses interlocking terrain coverage instead of a fixed
half-opacity diamond: coarse patches break the straight contour and smaller
patches soften their fringes. Complementary opposite masks meet across the edge,
and the original tile cores and foreground sprites remain intact. This is already
visible in [the native/HD terrain comparison](review/native-land-edges.png).
The four-quarter format still repeats a fixed edge pattern; pair-specific
transitions and world-position variation belong to the later renderer upgrade.

The river prototype uses irregular cubic meanders with fixed connection endpoints
and tangents. A world-space width field widens and narrows channels; smaller
position-dependent modulation makes the two banks asymmetric. Bank textures mix
subdued gravel and vegetation instead of outlining every bend in pale sand.
Inland water has finer texture and a subdued
green tint, fading into the existing coastal water near a mouth. The native/HD
16-mask bank uses the same curve family with edge widths pinned for compatibility.
The proposal varies width and bend phase in world coordinates, never camera space.
Add fractal bank relief after this broad shape, with six decreasing, domain-warped
octaves. The prototype uses dense native bank outlines with smooth falloff only
near connection ports, and continuous bank sampling in the enhanced view.
Preserve a positive minimum channel width; expand cached segment bounds for the
full displaced bank envelope. Copy connected segment neighborhoods across world
wrapping, with periodic widths and relief, and union the river water field with
the coastal field so mouth banks end in water. Filter subpixel frequencies by
physical resolution. Bake native art and cache enhanced ground chunks; the
offline pixel sampler is not a per-frame performance recommendation.
[Compare all four river variants and two zooms](review/river-fractal.png).

Coasts and rivers should share water color, shallow-water range, shore width and
mouth opening. Do not use an opaque diamond cutout as a tall terrain feature.

The new 4×4 material master contains four variants each of grassland, plains,
desert and calm water. The prototype blends choices on a stable three-tile world
lattice; choices do not change while panning. Mip levels reduce texture contrast
at overview scales. The retained four-phase ground and coast banks can be used
by a bounded atlas implementation; their phase is world-derived, never chosen
independently for each visible tile. Shared samples remove seams more reliably
than trying to disguise gaps with more painted detail.

For land-to-land edges, the first step is artwork: the existing native neighbor
quarter slots can carry a soft, irregular alpha ramp up to half opacity at the
shared edge, fading to zero toward the tile center. The native/HD replacement
bank now does this for every land material. Keep the center colors and feature
silhouettes distinct; avoid a universal grass fringe that changes desert, snow
or wetland identity. The native source still suppresses these overlays below
32 logical pixels per tile.

Use sparse, recognizable terrain details inside that protected core: the
replacement desert now includes cacti, while forests mix round broadleaf crowns
and pointed conifers within the existing native mask bank. For additional
variation, hash tile-lattice coordinates rather than raw staggered x/y: odd
coefficients modulo four otherwise select only two variants. The enhanced
prototype now uses all four forest images and omits cactus details below 48px
logical tile width, leaving sand color to identify the overview terrain.

The separate enhanced prototype narrows material blending to an organic band
around each boundary, with pure material cores. World-periodic weights and
shared samples avoid rectangular rims. Preserve a continuous land-color fallback
under full coastal footprints; a compact material blend must not leave dark
strips at the shore. [Real-save comparisons](review/land-borders.html) and
[checks](review/terrain-blend-validation.json) cover dry, rocky, cold and wet
regions, all ten terrain types, and both 64/128px tile sizes.

**Acceptance:** identical edge samples across independently rendered chunks,
no alpha cracks at fractional scale, stable texture choices during pan/zoom,
coast saddle and wrap cases, connected estuaries, no hidden terrain influencing
visible material choices, and no navigational ambiguity at narrow channels.

## 4. Zoom and level of detail

**Review: close, tactical, region and full-world presets.** The current two baseline stages
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
| 48–127 px | Full native unit/city frames, enlarged status badges; subdued terrain detail |
| 32–47 px | Sparse terrain features, simple transport lines, city and unit markers |
| < 32 px | Quiet terrain colors, major routes, cities and grouped unit markers; selected objects remain explicit |

The prototype uses 64 px for field detail and 48 px for tall features and marker
substitution. Above that threshold, unit/city sizes and anchors are exactly those
of the source object renderer, not reduced custom boxes. It demonstrates still-frame endpoints, **not** animated transition
hysteresis or unit clustering. The static enhanced renderer now resolves city
population/name collisions against unit tags and other labels using bounded,
deterministic placement; population boxes draw in the final overlay pass.
Replacement-native/HD use per-sprite authored size-box anchors. Inspect the
[anchor sheet](review/city-size-anchors.png) and
[label checks](review/city-label-validation.json). Production should add a small
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
selection, assigns relative physical sizes from `city/panorama/layout.json`, and
places larger landmarks before fitting smaller structures around their visible
silhouettes. Drawing then sorts by ground-contact depth, independently of slot
allocation. Rear and foreground curtain walls surround the settlement, with the
gate in the foreground. A near-frontal gate uses explicit attachment points
inside its towers so both curtains join at the same ground height. Match these
points to the trimmed sprite frame rather than leaving a fixed-width gap; keep
the gate's facade aligned with the foreground walls. The throne prototype assigns explicit back-to-front
layers and floor anchors to the same selected upgrade levels. Neither requires
3D geometry.

Move art-specific crop, anchor and occupancy information out of implicit resource
sheet rectangles into a versioned metadata file. Retain the game-state selection
in `CityViewWindow::layout_buildings` and `ThroneRoomWindow::render`. Permit a slot
to refer to a composed layer (for example paired columns) without changing its
gameplay meaning. Define occlusion intentionally so a last-drawn room decoration
does not obscure the throne. Include empty, partial, mixed and complete states.
The compatibility bank remains the native-layout baseline. For the panorama
upgrade, keep canonical sprite aspect ratios, define sizes independently of sheet
rectangles, and use the native slot as a preferred anchor rather than an enforced
bounding box. The prototype defines all 38 improvements and 28 wonders in house
units; pyramids and the coliseum have substantially larger footprints than housing.
Keep allocation order separate from painter order. Include enlarged bounds in
clipping, scrolling and picking, and composite the wall's rear/front layers around
the other objects. A production implementation should cache silhouette occupancy
and layout results, validate crowded selections and preserve selected-building
visibility during interaction. The offline prototype makes no frame-rate claim.


## 6. Diplomacy audience: density first, readable columns second

**Review: Diplomacy, all four stages.** Current source: government-dependent
640×480 art, a 225×275 portrait at `(208,57)`, overall power rank minus one repeated
icons at `(45,130)` and six technology slots at `(485,130)`. The source uses
31-pixel row spacing, era-dependent category crops and a narrow 58-pixel text
box. These rules come from `DiploLeaderWindow` in `src/auto/diplomacy.cpp`.

**HD-only scope:** supply RGBA backgrounds, portraits and category sprites at
higher density while keeping those logical rectangles. Replace palette entry
copying with explicit color masks. Keep static portraits as the supported
replacement-art path; an animated herald is a separate media decision.

**Additional scope:** build on the native background's fixed contrast plaques
with measured, wrapping labels and data-dependent panel sizing. Keep the portrait's existing size; make
the columns fit their data rather than distorting the leader. Separate the icon
rectangle from the label rectangle and make the whole row the hit target.
The proposed preview demonstrates the contrast panels and wider name area.
Treat the military column as an ordinal civilization-power indicator. Preserve
the source's era selection and rank 1..7; do not imply a troop roster or attach
unit names to its repeated weapon symbols. The enhanced preview replaces the
repeated symbols with one era emblem, a single foreign-minister rating label
(Pathetic through Supreme), and six segments filled `rank - 1` times. This is
relative power, not an absolute force count or a combat prediction. Bind the
label through localization metadata; the review uses the inspected English set.
Select enhanced knowledge artwork by stable advance ID: the fixture now shows
a coin, governor, mortar, astrolabe, atom and electrical coil for its six advances.
Retain the five native era/category icons as the baseline and as an explicit
fallback for advances without individual art in a future integrated engine.
Keep icon metadata independent of localized names and displayed row order;
missing files must not silently substitute an unrelated exploration symbol.
Future dialog choices should occupy a distinct measured text panel, preserve
keyboard navigation and never overlap the portrait. No synthetic conversation
choices are presented as a native diplomacy dialog in this review.

**Acceptance:** all seven governments and four eras; ranks 1 and 7; zero/six
known technologies; short and long localized names; 100–300% density; static
portrait framing; input regions and treaty/embassy visibility. Validate the
actual dialog path separately from this static leader-window fixture.

## 7. Spacecraft: retain the assembly state, introduce attachment metadata

**Review: Spacecraft assembly and complete.** The existing renderer executes 88
part rows in `src/game/bigframes.cpp`. It chooses filled/empty resources using
two count sets, selects one structural frame and composes into a 457×304 surface
at `(175,99)`. `src/auto/spaceship.cpp` adds statistics from `(10,40)`, the status
line near y=449 and buttons at y=417. This split-crop contract was designed for
one particular sheet arrangement; independent replacement module drawings can
overlap or float even when every source position is reproduced faithfully.

**HD-only scope:** retain the exact part thresholds, crop rectangles, composition
order, buffer and status/button geometry, with higher-density RGBA images and
transparent empty attachments. The first two previews isolate that change.

**Additional scope:** define logical attachment ports, a shared component scale,
truss layers, occlusion order and an empty/installed state for each port. Use one
whole component image where the old sheet required several crop fragments.
`space-layout.json` now contains the proposed four-bay layout; the preview uses
the same supplied six part counts. Draw connectors behind components, use a
quiet assembly background, and group statistics with explicit values and meters.
This remains a fixed 2D illustration assembled from sprites. Structural counts
must control the enabled truss/ports; do not infer legal attachment state from
whether a sprite happens to be visible. Keep launch eligibility in gameplay.

The mockup demonstrates ports, empty slots and a common visual scale. Its sample
stats are declared inputs, not simulated travel/success calculations. Production
must retain `spaceship_calc_stats` and source attachment limits unchanged.

**Acceptance:** empty, partial and maximum counts, every filled/empty threshold,
structural stages, clipped edges, supported/future ports, launch-state button
visibility, paused typing/full-text presentation, and matching values before
and after resizing. Render the same state with both layouts during migration.

## 8. City management: preserve the dashboard, reduce stockpile clutter

**Review: City window and crowded city.** This is `CityWindow`, not the separate
`CityViewWindow` panorama. `layout_rects` partitions a 636×421 content area into
citizens, resource map, food, production, supported units, improvement list and
info panel. `apply_size` currently switches among half, native and 1.5× layouts;
citizens and stockpiles compress through `ui_calc_item_spacing` when crowded.

**HD-only scope:** retain panel coordinates, source citizen ordering, stockpile
capacity, production selection, unit cells, list order and scroll position.
Scale image density and text rasterization independently from `view_scale`;
update clipping and mouse coordinates through the same DPI transform. The
previews execute the original stockpile, citizen and list algorithms.

**Citizen selection:** preserve all 44 source slots, including continuous
male/female alternation across mood groups and the technology-selected era.
Specialists select one role portrait per era. Native/HD-only use the same
portrait binding; a small mood or profession cue is an optional enhanced layer.
Draw those cues after the complete portrait row so overlap does not hide them.
The [four-era comparison](review/citizens.html) shows the distinction at native
size and enlarged, with original artwork available locally.

**Additional scope:** retain the recognizable panel arrangement, citizen art,
and background-provided borders/contrast; add measured labels and responsive panels.
Offer numerical food/shield meters with a visible granary threshold instead of
hundreds of tiny overlapping icons. Preserve exact numbers and make the original
icon display an optional presentation mode. The prototype shows these meters
and simpler resource bars; it does not change city calculations. Reserve separate,
adjacent icon and numeric-label boxes within each stockpile panel. Keep them clear
of the production heading/artwork, meter and button panel; do not position them
using coordinates from the old icon-grid layout.

Preserve every existing city action when simplifying the dashboard. The enhanced
mockups retain Buy/Change beside production; Info, Map, Rename, Happy, View and
Exit in the bottom panel; previous/next-city arrows; and the improvements
scrollbar. Their bounds follow `create_controls`, `create_change_button` and
`create_exit_button` (`src/auto/city.cpp:16712–17046`), with the enhanced button
styling. These static previews show the controls, not interactive callbacks or
alternate notice/autobuild states.

For a later independently scoped layout pass, replace the three hard size jumps
with logical minimum sizes, allow the improvements list to gain rows on taller
windows, and page or wrap crowded citizens with an explicit total. Do not shrink
all citizens and unit sprites to force a fit. Keep the worked-tile map's exact
21-cell picking geometry. Use a shared semantic symbol bank: food sheaf,
production shield, trade arrows, gold coin, luxury gem and science beaker.
Terrain specials (grain/shield, gold ore) must not substitute for economy roles.
Keep silhouette and color consistent between summary rows, stockpiles, upkeep,
sale actions and the small worked-tile food/shield/trade overlays. Density-only
support changes raster detail, not which symbol or logical rectangle is used. The present preview retains the native citizen row,
so population-28 overlap remains visible as a documented follow-up rather than
being silently hidden by smaller sprites. Happiness/support modes and actual
button/click handlers still need runtime integration checks.

**Acceptance:** populations 1, 12, 28 and maximum supported size; specialists,
anger/disorder, empty/full/overflow stockpiles, unit versus improvement production,
long building names, list scrolling, all three info modes and 100–300% DPI.
Use game-owned values for every displayed quantity; rounding or aggregation must
not change food retention, production progress, upkeep or orders.

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

## Map readability: artwork versus additional engine work

The original-art comparison exposed improvements that do not need new game
logic. The replacement native and HD-only stages now share winding ochre roads,
straight cool-gray rails with distinct sleepers, centered resource frames,
contrasting faction/health colors, a full shield silhouette and corrected coast
mask/dither artwork. These are art/binding changes under the existing native
sprite selection and logical dimensions. Native coast quarters retain a fuller
rounded land apron inside their diamond footprints. Keep forest and field tips
on land; preserve lake centers and use shared texture phase at joins. Terrain yield
markers should be smaller and lower contrast than unit tags; the map uses an
olive/bronze production shield while city economy symbols remain blue.
Shared network endpoints must remain
identical for all connection masks; a changed junction must not move its arms.
Banner faces stay flat, with darker rear shields identifying stacks. Use the
source-supported per-unit shield anchors to clear the replacement silhouettes: the
naval sprites use upper-left registration in every replacement stage, without
changing source draw order or shrinking the ship. This is an asset-registration
fix, separate from the enhanced foreground-badge pass below.

The cohesion stage separately demonstrates these scoped renderer changes:

- Evaluate shoreline footprints in world coordinates with smooth inward joins
  and broad asymmetric relief plus finer erosion. Preserve pure land/water
  centers and narrow passages. Vary the sand/rock band and break up surf instead of tracing
  every coast with an equally bright ribbon. The primary bank includes phase
  variants; world-space sampling prevents camera movement from changing them.
- Use stable position-derived road bend variants, while retaining the same
  connection endpoints and tangent directions. Rails keep straight approaches.
  Keep road/rail colors distinct at regional LOD even when sleepers disappear.
- Place resources by their tile-center anchor. Use one fit operation when
  producing the asset, not another fit and offset during composition. Retain
  recognizable fish/whale silhouettes at medium map zoom.
- Separate unit status badges from the unit image. The proposal scales badges
  to 135% of their native size, increases the visible rear-shield separation,
  and adds a plus marker when the native trace identifies a stack. This means
  multiple units, not an invented exact count. Draw badges above units; preserve
  health/order semantics, source visibility and the existing unit/city frames.
  Runtime integration must include the larger badge bounds in clipping and dirty
  rectangles, plus focused checks for crowded cities and viewport edges.

These are sprite and 2D composition changes. The review does not implement them
in the game or claim a complete bridge/rail-turnout solution. The district's
explicit two-unit stack and ocean resources complement the actual saved-game
scenes. All four comparison stages use the same updated synthetic fixtures.

### Fuller shoreline footprints and ground coverage

The saved-map survey uses rounded distance lobes with broad irregular coves and
headlands. Adding fine noise to rounded squares left the tile grid too visible;
the underlying contour therefore changes as well. A minimum rounded radius
protects occupied tile tips without reinstating square corners. Broader smooth
inward joins soften enclosed lakes. Keep vegetation and field footprints inside a
narrow land apron, join inward corners smoothly, preserve single-cell lakes and
land centers, and sample
river mouths through the coastal apron. Use the same shore field for terrain,
ground-level overlays and zoom transitions; retain elevated sprite silhouettes.
For native/HD compatibility, the replacement quarter art already carries the
protected footprint and periodic contour variation, while source draw commands
and zoom cutoffs stay fixed. Add close-up fractal detail after the macro contour
shaping, rather than feeding every scale through the same saturating function.
The prototype uses six domain-warped, decaying octaves and tapers fine relief at
concave joins; it fades out completely at 32 projected pixels and below. Keep
each octave tied to world position, and filter according to physical pixel size
with room for isometric foreshortening. Preserve lake connectivity at actual
world noise phases as well as generic atlas masks.
[The zoom comparison](review/coast-fractal.png) distinguishes game zoom from
mere enlargement of a retained image.
Generate the fractal contours during asset authoring or ground-cache invalidation,
then render ordinary sprites or cached chunks each frame. The offline pixel
sampler demonstrates the artwork; it is not a production frame-time budget. The enhanced proposal uses world coordinates for
variation, with frequencies matched to the wrap period so the east/west edge
stays continuous. Keep the broad contour independent of camera position and
fade only subpixel detail as projected scale falls. The prototype samples relief
around each land footprint rather than displacing every ground pixel independently,
which keeps the fine notches attached to the parent coastline. Ground sprite
coverage must partition the pixel lattice: do not independently antialias adjacent
opaque ground masks and then alpha-over them, which leaves dark seams. Composite
ground before final resampling or retain exact pixel-center coverage as the
standalone review does. Continue ordinary alpha blending for foreground sprites.

[The saved-world survey](review/coast-audit.html) separates native 16/32px square
tiles from the proposed continuous coasts, and includes 48/64px whole-world maps
plus 64/128px island, lake, forest/field, river-mouth and wrapped-edge inspections.
These renderer upgrades remain recommendations; game source is unchanged.
