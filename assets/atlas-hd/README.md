# Atlas HD

Open [the offline review gallery](index.html). Use **All four stages** to compare
original artwork, replacement art at native resolution, HD only, and HD with
additional cohesion. No server is required. All four in-game scene comparison
stages are checked in. Rebuilding original-art scenes requires an installed game;
viewing them does not.

[Compare these original-art mockups with runtime screenshots](review/fidelity.html).
The audit records corrected fonts, panels and restored text overlays; the
standalone renders are not pixel-equivalent game screenshots. See the
[fidelity findings and correction scope](FIDELITY-AUDIT.md).

This is one selected library on `new-graphics`, based on
`bd89036`. Earlier iterations remain on `codex/atlas-hd-graphics` at `2fe6f3f`.
The graphics branch contains no game source or loader changes.

## Contents

| Collection | Selected assets | Purpose |
| --- | ---: | --- |
| Painted sprites | 576 | Units, cities, buildings, wonders, resources, citizens, advisors, leaders, diplomacy, palace, effects, spaceship and setup art |
| Backgrounds | 22 | City sites, throne room, council, diplomacy, space, events and interface scenes |
| Interface assets | 503 | Authored SVGs and PNGs: controls, cursors, badges, masks, symbols and palette-dependent variations |
| Map assets | 1,117 | Ground, coast states, road/rail/river masks, shadows, materials and 16 new texture variations |
| Painted knowledge additions | 2 | Medicine and Electricity; four other advance-specific icons reuse retained art |
| Citizen mood/profession cues | 7 | Shape-distinct SVG/PNG badges for the enhanced city window |
| City panorama wall assembly | 7 | Separate rear and foreground SVG/PNG curtain walls for the three city sites, plus a frontal painted gate |
| Native window backgrounds | 9 | Source-aligned city, seven government diplomacy and spacecraft SVG/PNG plates |
| Terrain production marker | 1 | Muted olive/bronze shield for map terrain; city economy shields stay blue |
| Renderer bindings | 404 | Derived PNG adapters for the exact native boxes exercised by the review fixtures |

The 2,244 primary entries are indexed in [manifest.json](manifest.json).
Supporting mip PNGs and overview icons live under `map/variations/mips/` and
`map/lod/`. The compatibility bank is indexed separately in
[compatibility/bindings.json](compatibility/bindings.json); it is derived from
the same selected art, not a competing art direction.

[coverage.json](coverage.json) maps the 347 inventoried embedded image resources
and 13 external image-sheet/font roles to replacement artwork. It preserves the
inventory's exclusions and runtime obligations. This demonstrates asset-role
coverage, not that the unchanged game can already run without original images.
Scenario-specific images, video, audio and third-party expansion content are not
silently included in that claim.

## Four rendering stages

1. **Original game artwork:** original image sheets and embedded resources, replayed
   at native resolution with the same fixtures and cameras. Original city/flag and
   unit/shield registration points come from their sheet markers. This is a local
   source-renderer replay, not a screenshot captured from the original executable.
2. **Replacement native resolution:** source-selected commands, new art reduced to native
   sprite boxes, source zoom scaling and nearest-neighbor enlargement.
3. **HD only:** the identical command trace, with larger RGBA images and a 2×
   display-density backing surface. Layout, road arms, coast quarters, source
   ordering, visibility and zoom gates stay the same. This is the expected first
   engine upgrade, simulated by the review backend.
4. **HD + cohesion:** a separate art-side prototype adds shared network geometry,
   world-space materials and river/coast sampling, quieter overview detail,
   object anchors and site-aware scene placement.

There are 22 scene comparisons: three real-save map views plus district, close and tactical map views, transport
matrix, coast, terrain repetition, region, full world, three city panoramas, three
throne stages, diplomacy, two spacecraft states and two city management windows.
Detailed map views retain the native unit/city frame size and anchor. The proposal
enlarges status badges separately; only overview views substitute object markers. The city management window is separate from
the panorama. See the [window audit](RENDERER-AUDIT.md#window-renderer-extension)
for native bodies versus explicit panel and typography adapters.
The close camera spans ten full tile widths by ten full tile heights (200 cells
on the staggered lattice). The whole-world fixture has 8,192 valid cells in a
128×128 coordinate domain. Twelve 3840×2160 review exports are available for
the close map, coast, coastal city and complete throne room, at the three replacement
stages. Building the original comparisons adds four corresponding 4K exports.
These exports preserve aspect ratio and can resample the native art; they do not
claim additional native 4K detail.

## Native window backgrounds

Replacement-native and HD-only city/diplomacy/spacecraft windows now use
backgrounds aligned to the existing source layout. City panels separate the
citizen strip, resource map, economy bars, storage, production, units and lists.
Diplomacy provides light plaques behind the unchanged dark technology text and
six military/knowledge slots. Spacecraft statistics and titles have quiet dark
backing. These are background substitutions, not additional layout upgrades.

The [nine background plates](review/native-backgrounds.png) have editable SVG
sources and 4× PNGs in [interface/native-backgrounds](interface/native-backgrounds/).
[Layout metadata](interface/native-backgrounds/layout.json) records source
rectangles and input hashes. The previous painted backgrounds remain inputs and
support the enhanced compositions; they are not competing native skins.
No source text, controls, icons, counts or foreground positions change.
[Validation](review/native-background-validation.json) checks ten unchanged
foreground renders, source panel bounds and native-text contrast.

## City economy and real-save maps

The city window uses six distinct [economy symbols](review/economy-symbols.png):
the retained full wheat sheaf, blue production shield, opposed trade arrows, painted antique gold coin, luxury gem
and science beaker. Coins also identify the improvement-list sale/upkeep action.
The old mixed grain/shield terrain special and gold ore no longer serve as city
economy icons. Native 14-pixel rows and 10-pixel worked-tile icons share these
silhouettes. See [semantic bindings](interface/economy/bindings.json).

The first three map scenes use `he_a1788.sav`: a 150×120 staggered world with
9,000 tiles, all 11 terrain kinds, 69 cities, 223 live units (290 allocated unit
records), 597 road tiles, 282 rail tiles and 320 special-resource tiles. Close,
regional and complete-world cameras share the same imported state in every
stage. Fog is deliberately disabled for this all-map art review. The importer
preserves terrain, improvements, city sizes/styles/walls, unit types/stacks and
damage; source functions select resources and display units. No saved game or
original image file is needed to rebuild: the bounded imported state and input
hashes are retained in [saved-world.json](review/fixtures/saved-world.json).

`import-save.py SAVE RULES.TXT` is an optional read-only refresh step. It accepts
the observed version-44 normal-save layout, checks bounds and stack links, and
records the input hashes. It does not support arbitrary scenario/network/save
versions. The original save and rules file are not included in this art pack.

The flat irrigation and farmland overlays now reach the tile's outer edges so
they remain visible around unchanged city sprites. The enhanced stage also
retains the native rule that carries neighboring fields beneath a city.
[Compare Carlisle and Gloucester in all four stages](review/irrigation-cities.png).
The comparison contains only crops of the permitted composed original-art scene;
its original-art column is excluded from the replacement pack's license.

Forest ground blends grass and undergrowth around the tree clusters.
Mottled leaf litter sits beneath the trees; the native tile perimeter retains
opaque coverage and uses the grass palette to avoid dark diamond borders.
The enhanced renderer blends the same materials through its existing world-space
terrain pass. [Compare forest borders in all four stages](review/forest-borders.png).
Terrain selection, neighbor dither selection and native drawing order are unchanged.
The forest bank now pairs round broadleaf canopies with two newly painted
pointed evergreen groves. Native mask slots 3, 8 and 10 use conifers, following
the silhouettes observed in the original bank; the other slots use broadleaf
woods. The enhanced pass selects all four variants from actual tile-lattice
coordinates, avoiding the two-variant collapse caused by staggered x/y parity.

Desert ground includes a small cactus cluster inside its protected material core.
It remains ordinary terrain detail, below the native river, fields and roads.
Enhanced cacti appear at 48px tiles and above, below fields and networks, and are
omitted on cultivated or river desert. [Compare desert and forest details](review/terrain-vegetation.png).
[Artwork checks](review/vegetation-validation.json) cover unchanged perimeter
pixels, small-scale contrast and variant coverage. Generated masters and the
[built-in image-generation prompts](authoring/terrain-vegetation.json) are retained.

All ten land styles use interlocking patches of the actual neighboring terrain.
The forty native edge PNGs now carry four scales of warped coverage, including
dense tufts and tongues with a light color wash beneath their softer fringes. They replace the former
uniform half-opacity line along the tile diamond. Opposite quarters have
complementary edge coverage; narrow quarter tips fade to avoid rectangular cuts.
The existing protected core remains untouched, including the desert cacti.
Base terrain PNGs, foreground sprites, source-selected quarter slots, draw order
and zoom gates are unchanged. This artwork update benefits replacement-native
and HD-only rendering without adding renderer rules. The enhanced pass retains
its separate world-space transition weights and coastal color support. [Inspect the four-stage land comparisons](review/land-borders.html)
from four regions of the real save at 64/128px tiles, covering all ten land types.
[Transition checks](review/terrain-blend-validation.json) cover material-core
preservation, complementary native edges, world wrapping and coastal color support.
[Uncluttered four-stage comparisons](review/native-land-edges.png) show grass/desert,
grass/swamp, tundra/glacier and plains/hills through the same extracted renderer.
These four small fixtures keep units and infrastructure out of the comparison;
the saved-map review retains the complete game scene.

## Rebuild

The standalone renderer requires Windows, MSVC x86 C++ build tools, a Windows
SDK, Python 3.10+ and Node.js with `sharp`. Its build script discovers Visual Studio
with `vswhere`. Install `sharp` in a normal Node module location, or point
`ATLAS_NODE_MODULES` at a directory containing it. The tool package pins the tested
`sharp` version; use `npm install --prefix tools/atlas-review` if needed. The Codex bundled runtime is
also recognized. No original executable, GIF, BMP, DLL image or Freeciv file is
read by this pipeline.

Run from the repository root:

```powershell
./tools/atlas-review/build-engine.ps1 -Configuration Debug
./tools/atlas-review/build-engine.ps1 -Configuration Release
node tools/atlas-review/build-review.cjs
node tools/atlas-review/build-support.cjs
node tools/atlas-review/windows.cjs
node tools/atlas-review/saved-map.cjs
node tools/atlas-review/verify.cjs
node tools/atlas-review/build-gallery.cjs
```

`build-review.cjs --reuse-bindings` reuses the derived PNG bank when only the
renderer or fixtures change; forest ground and land-transition overlays are
still regenerated. Full builds recreate the bank. Build products and
extracted source bodies remain in ignored `build/atlas-review/`. Review images,
fixtures, hashes and traces are deliberately versioned. The primary retained
sprite files are retained native crops or full generated images; the rebuild reuses
them and their retained masters instead of making a new image-generation request.
After field-art edits, run `fields-review.cjs`, `verify-fields.cjs` and
`build-gallery.cjs` in `tools/atlas-review/`. The field review refreshes the five
affected maps and the Carlisle/Gloucester comparison without changing fixtures.

The full review builder also regenerates forest ground, vegetation and land-transition overlays.
After forest-floor edits, first run `forest-floor.cjs`. For either forest or
general land-transition edits, run these tools from the repository root:

```powershell
node tools/atlas-review/terrain-vegetation.cjs
node tools/atlas-review/terrain-blends.cjs
node tools/atlas-review/terrain-edge-pairs.cjs
node tools/atlas-review/refresh-map-finishing.cjs
node tools/atlas-review/coast-audit.cjs --skip-original
node tools/atlas-review/refresh-native-backgrounds.cjs --render-only
node tools/atlas-review/land-borders.cjs
node tools/atlas-review/vegetation-review.cjs
node tools/atlas-review/verify-terrain-vegetation.cjs
node tools/atlas-review/fields-review.cjs --review-only
node tools/atlas-review/refresh-unit-banners.cjs --review-only
node tools/atlas-review/verify-terrain-blends.cjs
node tools/atlas-review/verify-coast-audit.cjs
node tools/atlas-review/verify.cjs
node tools/atlas-review/verify-fields.cjs
node tools/atlas-review/verify-map-style.cjs
node tools/atlas-review/verify-map-finishing.cjs
node tools/atlas-review/build-gallery.cjs
node tools/atlas-review/fidelity.cjs
```

The window refresh updates the native/HD city resource maps as well as the main
map scenes. The supplemental original-art comparisons require the local original
bindings described below; only their composed scenes are versioned.

The native executable can also emit an individual command trace:

```powershell
./build/atlas-review/Release/atlas-engine.exe map assets/atlas-hd/review/fixtures/close.txt
./build/atlas-review/Release/atlas-engine.exe city assets/atlas-hd/review/fixtures/city-coastal.txt
./build/atlas-review/Release/atlas-engine.exe throne assets/atlas-hd/review/fixtures/throne-complete.txt
```

The window executable uses the same build configurations:

```powershell
./build/atlas-review/Release/atlas-windows.exe diplomacy assets/atlas-hd/review/fixtures/diplomacy.txt
./build/atlas-review/Release/atlas-windows.exe spaceship assets/atlas-hd/review/fixtures/spacecraft-assembly.txt
./build/atlas-review/Release/atlas-windows.exe city-window assets/atlas-hd/review/fixtures/city-window.txt
```

For background-only updates, run `node tools/atlas-review/refresh-native-backgrounds.cjs`,
then `verify-native-backgrounds.cjs`, `verify.cjs`, `build-gallery.cjs` and
`fidelity.cjs`. This refreshes only the ten native/HD window images.

Run `windows.cjs` after the other image builders: it adds the five window scenes
to the existing scene index. It also refreshes seven editable SVG/PNG window
components, the nine native background plates, `space-layout.json`, and the recorded artwork draw plans. No dated
or alternate asset-pack directories are created.

See [renderer boundaries](RENDERER-AUDIT.md),
[scoped upgrade recommendations](RENDER-UPGRADES.md),
[validation results](review/validation.json), and [provenance](PROVENANCE.md).

## Review and integration status

The complete selected set is reviewable without the earlier packs. Integration
still needs an explicit PNG/metadata loader and the HD rendering work described
in scope 1. Compatibility bindings cover the displayed fixtures; the primary
catalog and coverage map cover the broader art roles. Gameplay initialization,
all window layouts and a complete runtime replacement-resource test remain
future integration work. No new Ghidra facts or annotations are introduced.

## Original game art comparison

The 22 composed original-art scene comparisons and four 4K exports are checked
in under [review/original-scenes](review/original-scenes/README.md), as authorized
for reviewing the in-game mockups. This includes both city windows, both
spacecraft states, city panoramas, thrones, the composed transport test views
and all saved-game maps. A fresh checkout displays all four stages without an
installed game. `renders.json` records dimensions and hashes; `data.js` supplies
the gallery index.

Original artwork has separate rights from Atlas HD. These scene references are
**not replacement assets and are outside the replacement pack's license**.
Source sheets, extracted sprite crops, bindings, traces and the original citizen
contact sheet remain ignored in `review/original-local/`; they are not included
in this exception. The canonical manifest, replacement bindings and game source
do not depend on any original-art render.

From the repository root, with Python + Pillow, Node + sharp and MSVC x86:

```powershell
./tools/atlas-review/build-engine.ps1 -Configuration Debug
./tools/atlas-review/build-engine.ps1 -Configuration Release
python tools/atlas-review/original-assets.py --game 'C:/path/to/your/Civ2'
node tools/atlas-review/original.cjs
node tools/atlas-review/build-gallery.cjs
```

`CIV2_GAME` can supply the installed game directory instead of `--game`.
The extractor reads seven original GIF sheets plus CV/PV/MK/SS DLL image
resources without executing them. It checks crop bounds, records input/output
hashes and verifies inputs remain unchanged. The replay verifies all scene
sizes, binding hashes and original map/city/throne Debug/Release trace equality.
Rerun these commands after changing fixtures or source renderer extraction.

The original and HD-only stages use the same corrected content geometry:
reference metrics, source knowledge fitting and economy bars, source
resource terrain, saved map names and panorama titles. Enhanced compositions
remain separate. Original CITY.GIF and SS resource 499 supply the original
backgrounds; cropped original button art and per-window palettes remain local.

Replacement-native and HD-only previews use smooth replacement fonts fitted to
source text spans; only original-art previews use the reference bitmap glyphs.
Enhanced map city names and population badges are final overlays with collision
placement; panorama titles remain above the artwork. Replacement-native/HD use
per-sprite city-size anchors. Inspect the [anchor sheet](review/city-size-anchors.png)
and [population-label checks](review/city-label-validation.json).
[Typography checks](review/typography-validation.json) cover font separation, HD
rasterization and label pixels in the saved-map and panorama renders.

The city preview is a content rectangle, without application title/border
chrome. Herald animation and identical-state runtime pixel parity remain
unverified. See [fidelity corrections and validation](FIDELITY-AUDIT.md).

## Map readability refinements

The four-stage gallery now uses revised replacement coast and transport artwork.
Roads are warm dirt tracks with winding arms; rails retain straight approaches,
cool ballast, pale steel and transverse sleepers. Shared endpoints remain fixed
for isolated, connected and junction sprites. Canonical network and coast PNGs
and SVGs are rebuilt in place, rather than kept as alternate art packs.
Native rail arms meet with flush center cuts instead of overlapping end caps.
The proposed renderer draws all ballast, then sleepers, then steel; continuous
through routes replace radial stubs at rail junctions.

Coasts use rounded lobes and broad asymmetric coves/headlands, with patchy
beaches, rocky banks, shallows and subdued broken surf. The compatibility coast
bank also fixes the three-neighbor mask
and the former desert-filled coastal dither slot. Fish, whales and other resource
sprites are trimmed and centered inside their logical tile frame; the proposal
no longer fits them into a second, half-size frame.

Rivers use irregular meanders, a wider range of channel widths, textured water
and asymmetric gravel/vegetation banks. A faint sediment wash replaces the
continuous pale outline. Six octaves of domain-warped fractal detail now add
smaller notches within the broad meanders. Each native bank is sampled at 257
points; detail eases to zero with zero slope at the fixed-width connection ports.
The 16 native river sprites keep the same logical frames and mouth aliases.
The proposed ground pass samples banks in world coordinates, filters subpixel
octaves, and fades the added detail out at 32 physical pixels per tile or less.
The shared river/coast water field and wrapped boundary neighborhoods retain
continuous mouths and map-edge crossings. A fixed radial bank profile prevents
fine relief from creating detached water pockets. Native/HD bindings use the canonical
bank artwork directly. [Compare riverbank detail and mouths](review/river-fractal.png).

Faction shields have a larger filled silhouette within their existing native
frame, one flat faction-color face and a dark outline. The inset stripe/bevel is
removed; rear stack shields retain the darker faction color. Health and order marks
are readable; stacked units keep the source's repeated-shield indicator. The
cohesion stage additionally enlarges status badges by 35%, separates the rear
shield, adds a plus marker for stacks, and draws those badges over the unit layer.
The actual unit and city sprites keep the source-selected dimensions and anchors.
[Naval banner anchors](map/unit-anchors.json) move the shields into transparent
upper-left space so the native ship draw cannot cover them. Original-art anchors
remain separate. [Inspect ship and stack crops](review/unit-banners.png);
[48 visibility cases](review/unit-banner-validation.json) cover all twelve naval
types at native/HD density and two zoom levels. To rebuild just these changes, run
`unit-banners.cjs`, rebuild the standalone engine in both configurations, then run
`refresh-unit-banners.cjs` and `verify-unit-banners.cjs` under `tools/atlas-review/`.
The district fixture explicitly includes fish, whales and a linked two-unit stack;
the three 1788 save scenes still use unmodified imported gameplay state.

Rebuild the selected map library before the normal review build:

```powershell
node tools/atlas-review/refresh-map-art.cjs
node tools/atlas-review/build-review.cjs
node tools/atlas-review/build-support.cjs
node tools/atlas-review/windows.cjs
node tools/atlas-review/saved-map.cjs
node tools/atlas-review/verify.cjs
node tools/atlas-review/verify-map-style.cjs
node tools/atlas-review/verify-rail-joins.cjs
node tools/atlas-review/verify-rivers.cjs
node tools/atlas-review/verify-riverbanks.cjs
```

Then rebuild the optional original comparisons and gallery as described above.
Native coastal quarters use rounded distance lobes instead of rounded squares.
The minimum radius protects the full forest/field footprint without adding a
square envelope back into the contour; broader inward joins soften small lakes.
The macro shape is retained, with an independent fractal detail layer added after
its nonlinear shaping. Six domain-warped octaves halve in wavelength with
progressively smaller displacements, adding coves, ledges and notches within
larger coves. Bounded reflection avoids flattening the small contours; relief
fades at concave joins to prevent isolated water specks. Forest and field tips
remain on land. The enhanced sampler leaves the macro contour unchanged at
32 projected pixels and below, fades detail in above that, and suppresses
subpixel octaves. Native/HD use the filtered PNG bank.
Native contour variation joins periodically across tiles. The enhanced proposal
varies it over the world, with an exact repeat at the wrapped map boundary. The previous water overhang has been removed; all
quarter pixels stay within their existing 32×16 logical diamonds. Quarter and
open-ocean textures share one periodic tile phase, and the standalone replacement
compositor preserves opaque pixel-center ground coverage after scaling. This
removes transparent seams without altering the original-art replay, foreground
sprites, logical boxes or draw commands. River-mouth bank alpha fades seaward;
the enhanced proposal also extends river sampling into the connected ocean tile.

Ocean-neighbor edge slot 12 now carries a soft, irregular grass-textured feather
that matches the existing coastal apron. This removes the sharp sandy diamond
on the desert cape beside Newcastle in saved-close-hd.png. The source already
selects this slot only beside ocean; inland desert and the protected cactus core
are unchanged. All coastal land types use the same apron, as required by the
existing sprite bank. No renderer or coast-geometry changes are involved.
[Inspect the four-stage close-up](review/map-finishing.png) and
[coastal feather checks](review/coastal-blend-validation.json). Rebuild the four
slots with terrain-blends.cjs, then refresh the native/HD review scenes.

The terrain production marker remains a smaller olive/bronze silhouette; the blue
city economy icon is unchanged. [Inspect Newcastle and the terrain markers](review/map-finishing.png).

[Inspect fractal detail at two zooms](review/coast-fractal.png),
[compare shorelines and river banks](review/coast-contours.png), then
[explore the full saved-world coast review](review/coast-audit.html): four
comparison stages, all 9,000 cells at 16/32/48/64px game zoom, and eight selected
island, lake, river-mouth, cultivated/forest and wrapped-edge areas at 64/128px.
Use the display control and synchronized scrolling to inspect the larger maps.
The native engine omits coast quarters below 48px: native and HD-only 16/32px
panels deliberately retain that square-tile cutoff; enhanced keeps shore detail.
[Coverage and seam checks](review/coast-audit-validation.json) include all 256
native neighbor patterns, saved-map topology, Debug/Release trace parity, opaque
ground joins at ten scales, and unchanged river joins with fading mouth banks.
These are offline review renders, not a game integration or frame-rate claim.

Rebuild with `map-finishing.cjs`, `refresh-map-art.cjs --coasts-only`,
`refresh-map-finishing.cjs`, `build-support.cjs`, `windows.cjs`, then
`coast-audit.cjs` in `tools/atlas-review/`. Use `--skip-original` on the survey
when updating art with unchanged fixtures and existing original comparisons. Run `verify-coast-audit.cjs`,
`verify-map-finishing.cjs`, `verify-map-style.cjs`, `verify-rivers.cjs`,
`verify-fields.cjs`, `verify-shore-relief.cjs` and `verify.cjs`. Finally refresh the detail sheets with
`fields-review.cjs --review-only`, `refresh-unit-banners.cjs --review-only`,
`build-gallery.cjs` and `fidelity.cjs`. The full-world review writes only composed
original scenes under `review/original-scenes/coast-audit/`; raw originals stay
local and are excluded from replacement assets.

[Map style metadata](map/readability.json) records the artwork conventions;
[focused validation](review/map-readability-validation.json) checks road joins,
shore continuity, ocean-resource centering and preserved unit/city frames.
[Rail validation](review/rail-connectivity-validation.json) checks actual PNG
steel continuity at native arm centers and proposed shared boundaries in both
draw orders, plus every rail mask's endpoints.

[River validation](review/river-validation.json) checks all 16 native bindings,
fixed curve endpoints, continuous water across adjoining masks in both draw
orders, width variation and hidden-state isolation. The painted bed and water
overlap by 1.5 canonical pixels at each port to close antialiased butt seams;
logical endpoints and their tangents remain fixed. To rebuild only river art,
use `node tools/atlas-review/refresh-map-art.cjs --rivers-only` before rebuilding
the comparisons. This also refreshes the 16 native crops and four mouth bindings.
[Fractal bank validation](review/riverbank-validation.json) adds detail-scale and
wrap checks, all 16 enhanced connection masks at 256px and 512px, the saved map's 82 directed river
ports and 11 mouth ports, and a synthetic wrapped river. It checks connected
water, bank continuity across independently sampled boundaries and positive
channel widths. The review includes native, HD-only and enhanced close-ups at
64/128 logical pixels per tile plus magnified bank and mouth details.

## Diplomacy power indicator

The original military column repeats an era-specific weapon symbol
`power_rank - 1` times. It has no unit names and does not describe army
composition. The source rank ranges from 1 (Pathetic) to 7 (Supreme); the review
fixture's rank 6 means Mighty and produces five symbols.

Native and HD-only previews retain the source's repetition and rectangles,
using the existing ancient shield/sword, medieval helmet/crossbow, industrial
cannon and modern radar artwork. The enhanced column uses one era emblem,
the overall rating label and six segments with the same number filled as native
symbols. The labels follow the foreign-minister report's English ratings;
adding them to the audience is a proposed readability improvement. “Regiment”
and the hard-coded rifleman are removed.

[Compare eras and rating extremes](review/military-ratings.png),
[inspect bindings](interface/diplomacy/military.json), or
[read validation](review/military-validation.json). `windows.cjs` rebuilds the
scenes and runs `military.cjs` checks across all four eras and seven valid ranks
in Debug/Release, including the empty-symbol case and invalid input rejection.
The rank is supplied fixture state; no army or research simulation is claimed.

## Diplomacy knowledge icons

The original renderer uses five era-specific categories (Military, Economic,
Social, Academic and Applied), not a unique icon for every advance. Native and
HD-only replacements retain that selection through existing category artwork;
missing filenames no longer collapse every row to the same exploration icon.

The enhanced preview uses six distinct, topic-matched icons: Banking (coin),
Engineering (steam governor), Medicine (apothecary mortar), Navigation
(astrolabe), Physics (atom model) and Electricity (induction coil). See the
[icon comparison](review/knowledge-icons.png), [bindings](interface/knowledge/bindings.json)
and [validation](review/knowledge-validation.json). The new Medicine/Electricity
PNGs were generated with built-in image_gen; [prompts and provenance](authoring/knowledge.json)
record our authored style reference. The other four reuse existing painted art.

The diplomacy fixture now supplies actual advance IDs and base-game categories.
Ranking depths remain illustrative input, not simulated research. Each category
draw retains its advance ID so enhanced art does not depend on the label text
or row order. The original-art replay was refreshed for the corrected metadata.
`windows.cjs` rebuilds the replacement previews; `knowledge.cjs` checks six
unique enhanced images, all 20 era/category bindings, empty/malformed fixture
edges and Debug/Release agreement. Game source remains unchanged.

## Citizen eras, gender and readability

[Compare all four stages for every citizen](review/citizens.html). The source
loads four rows of 11 portraits. Each row contains male/female pairs for happy,
content, unhappy and angry citizens, then entertainer, tax collector and scientist.
Ordinary gender alternation continues across mood boundaries; specialist roles
have a single portrait per era. Era follows technology, not the calendar:
ancient by default; Invention plus Philosophy; Industrialization; Electronics plus
Automobile (the last condition takes precedence).

The replacement library already contains all 32 paired portraits and 12 era
specialists. `windows.cjs` now retains the source sprite's era and pair index via
[explicit bindings](interface/citizens/bindings.json), instead of collapsing them
to one industrial portrait per mood. The normal window demonstrates the industrial
set and all three specialists; the crowded window demonstrates the modern set.
All four stages use the same selected fixture state.

Only the enhanced variant adds small mood/profession badges within the existing
citizen frames. Expressions and profession props remain visible; badge shapes
supplement color. The badge pass follows the complete portrait row so crowding
cannot paint over earlier indicators. Native and HD-only keep the source order,
27x30 logical frames and overlap. No new portrait pixels or game source changes
are introduced.

`windows.cjs` rebuilds the windows, cues and era review. `citizens.cjs` alone
refreshes the review and validates all 44 slots against Debug/Release traces,
continuous gender alternation and the six replacement window variants. Optional
fixture input `citizens <era 0..3> <angry count>` follows the 21 worked-tile rows;
these values are supplied review state, not a technology simulation. The original
citizen contact sheet stays in `review/original-local/`; only composed in-game
scene renders qualify for the checked-in original-art comparison exception.

## Enhanced city panorama scale

The enhanced coastal, river and inland panoramas use explicit relative sizes from
[city/panorama/layout.json](city/panorama/layout.json). At equal depth, the pyramid
complex is 6.2 house-widths, the coliseum 4.7 and the city gate 3.0. Rear and front
curtain walls extend across the settlement. These are illustrative relative sizes,
not surveyed architectural dimensions. The canonical painted sprites retain their
aspect ratios instead of being fitted into the original small improvement slots.

Source selection is retained, including every house and improvement. Larger
landmarks reserve space first, placement accounts for transparent sprite areas,
and normal objects draw from back to front by their ground-contact Y coordinate.
The rear wall draws before buildings; the foreground wall and gate draw last.
The enhanced [gate sprite](city/panorama/gate.png) has a nearly frontal facade;
curtain walls terminate inside its towers at explicit, equal-height attachment
points. This replaces the sharply angled gate only in the enhanced panorama.
The original, replacement-native and HD-only panoramas retain the source layout.

Rebuild this proposal and its coastal 4K export without rebuilding the map:

```powershell
node tools/atlas-review/city-panorama.cjs
node tools/atlas-review/verify-city-panorama.cjs
node tools/atlas-review/build-gallery.cjs
```

The same proposal runs from `build-review.cjs`; run `city-panorama.cjs` after a full
build to refresh reusable wall layers, manifest hashes and saved layout plans.
[Layout plans](review/city-panorama-plans.json) and
[validation](review/city-panorama-validation.json) record selection, relative
widths, visible sprite fractions, depth order, opaque gate/wall joins and unchanged native/HD render hashes.
