# Standalone renderer audit

The source is **this repository**, `richardpenman-civ2`, at `bd89036`; no renderer
from the sibling `C:\Projects\civ2` project is used. The latter was only the
agent's scratch workspace. [Extraction metadata](review/engine-extraction.json)
pins the source file hashes, function names, source line numbers and body hashes.

## What is compiled

`tools/atlas-review/extract-engine.py` extracts 41 complete function bodies
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
  references, 404 PNG compatibility bindings and all 39 three-stage images;
- direction conversion and focused proposed-renderer visibility isolation.

These are finite renderer/asset checks. They do not establish all possible unit
stack, combat, editor, scenario or multiplayer behavior. No application source
has changed, so a full game runtime regression would not qualify this art-side
prototype. Future integration must test actual font metrics, input transforms,
wrapped maps, ownership/visibility transitions and resource-loader completeness.
